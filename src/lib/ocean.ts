/**
 * The purple ocean: thousands of lightsticks in perspective, rendered as additive WebGL points.
 * One draw call per frame. The loop only runs while the finale is on screen and the tab is visible;
 * in calm mode a single still frame is drawn. Callers fall back to a photograph if WebGL is unavailable.
 */

const VERT = `
attribute vec3 aPos;
attribute float aTone;
uniform float uTime;
uniform float uGlow;
uniform float uPulse;
uniform vec2 uSize;
uniform float uScale;
uniform float uLead;
uniform vec2 uPointer;
varying vec3 vColor;
varying float vAlpha;
void main() {
  float x = aPos.x;
  float z = aPos.y;
  float ph = aPos.z;
  float speed = 0.7 + fract(ph * 7.31) * 0.8;
  float wave = sin(uTime * 1.35 * speed + x * 0.23 + z * 0.31 + ph) * 0.22;
  float camH = 3.05 + uPointer.y * 0.35;
  float camX = uPointer.x * 2.2;
  float f = 1.35;
  // Projected in device pixels: the horizon sits uLead below the canvas top and the scale comes
  // from the viewport, so a taller canvas reveals more floor instead of stretching the crowd.
  float k = f * uScale * 0.5;
  // Portrait screens squeeze the crowd sideways so most of it stays in frame.
  float kx = k * clamp(uSize.x / (1.6 * uScale), 0.45, 1.0);
  float px = ((x - camX) / z) * kx;
  float py = uLead + ((camH - wave) / z) * k * 0.6;
  gl_Position = vec4(px / (uSize.x * 0.5), 1.0 - py / (uSize.y * 0.5), 0.0, 1.0);
  float fog = clamp(1.12 - z / 98.0, 0.0, 1.0);
  float d = length(vec2(x, z - 5.0));
  float ring = 0.0;
  if (uPulse > 0.0) {
    float delta = d - uPulse * 26.0; // pow() is undefined for negative bases in GLSL, so square by hand
    ring = exp(-(delta * delta) / 34.0) * clamp(1.0 - uPulse / 4.2, 0.0, 1.0);
  }
  float flicker = 0.8 + 0.2 * sin(uTime * 4.6 * speed + ph * 3.0);
  gl_PointSize = clamp((uScale * f * 0.19) / z * (1.0 + ring * 0.7), 2.0, 46.0);
  vAlpha = fog * flicker * (0.35 + 0.75 * uGlow) * (0.85 + ring * 1.6);
  vec3 purple = vec3(0.663, 0.439, 1.0);
  vec3 violet = vec3(0.48, 0.28, 0.77);
  vec3 lilac = vec3(0.86, 0.78, 1.0);
  vec3 ivory = vec3(1.0, 0.97, 0.94);
  vec3 c = aTone < 0.62 ? purple : aTone < 0.86 ? violet : aTone < 0.97 ? lilac : ivory;
  vColor = mix(c, lilac, clamp(ring, 0.0, 1.0));
}
`

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float core = smoothstep(0.32, 0.0, r);
  float halo = pow(1.0 - r, 2.2) * 0.55;
  float a = (core + halo) * vAlpha;
  vec3 col = mix(vColor, vec3(1.0, 0.97, 0.94), core * 0.55);
  gl_FragColor = vec4(col * a, a);
}
`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Shader allocation failed')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Shader compile failed')
  return shader
}

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type OceanOptions = {
  count: number
  maxDpr: number
  animate: boolean
  /** CSS px from the top of the canvas down to the horizon. */
  lead: number
  /** Reference height in CSS px that sets the crowd's scale (independent of the canvas height). */
  reference: () => number
}

export class PurpleOcean {
  private canvas: HTMLCanvasElement
  private gl: WebGLRenderingContext
  private program!: WebGLProgram
  private shaders: WebGLShader[] = []
  private buffer!: WebGLBuffer
  private count: number
  private uniforms: Record<string, WebGLUniformLocation | null> = {}
  private raf = 0
  private running = false
  private start = performance.now()
  private glow = 0.7
  private pulseStart = -1
  private pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  private resizeObserver: ResizeObserver
  private maxDpr: number
  private dpr = 1
  private lead: number
  private reference: () => number
  animate: boolean
  onLost?: () => void

  constructor(canvas: HTMLCanvasElement, { count, maxDpr, animate, lead, reference }: OceanOptions) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' })
    if (!gl) throw new Error('WebGL unavailable')
    this.canvas = canvas
    this.gl = gl
    this.count = count
    this.maxDpr = maxDpr
    this.animate = animate
    this.lead = lead
    this.reference = reference

    if (gl.isContextLost()) throw new Error('WebGL context lost')
    const program = gl.createProgram()
    if (!program) throw new Error('Program allocation failed')
    const shaders = [compile(gl, gl.VERTEX_SHADER, VERT), compile(gl, gl.FRAGMENT_SHADER, FRAG)]
    shaders.forEach((s) => gl.attachShader(program, s))
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Link failed')
    gl.useProgram(program)
    this.program = program
    this.shaders = shaders

    const rand = seeded(2024)
    const data = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      const z = 2.4 + Math.pow(rand(), 0.7) * 96
      data[i * 4] = (rand() * 2 - 1) * (z * 1.25 + 6)
      data[i * 4 + 1] = z
      data[i * 4 + 2] = rand() * Math.PI * 2
      data[i * 4 + 3] = rand()
    }
    const buffer = gl.createBuffer()
    if (!buffer) throw new Error('Buffer allocation failed')
    this.buffer = buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
    const aPos = gl.getAttribLocation(program, 'aPos')
    const aTone = gl.getAttribLocation(program, 'aTone')
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 16, 0)
    gl.enableVertexAttribArray(aTone)
    gl.vertexAttribPointer(aTone, 1, gl.FLOAT, false, 16, 12)
    for (const name of ['uTime', 'uGlow', 'uPulse', 'uSize', 'uScale', 'uLead', 'uPointer']) this.uniforms[name] = gl.getUniformLocation(program, name)

    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE)

    canvas.addEventListener('webglcontextlost', this.handleLost)
    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()
  }

  private handleLost = (e: Event) => {
    e.preventDefault()
    this.stop()
    this.onLost?.()
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr)
    this.dpr = dpr
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
    }
    this.gl.viewport(0, 0, w, h)
    if (!this.running) this.draw(performance.now())
  }

  setGlow(value: number) {
    this.glow = value
    if (!this.running) this.draw(performance.now())
  }

  setPointer(nx: number, ny: number) {
    this.pointer.tx = nx
    this.pointer.ty = ny
  }

  /** Sends a wave of light outward from the centre of the crowd. */
  pulse() {
    this.pulseStart = performance.now()
    this.staticLit = true
    if (!this.running) this.draw(performance.now())
  }

  resetPulse() {
    this.pulseStart = -1
    this.staticLit = false
    if (!this.running) this.draw(performance.now())
  }

  private staticLit = false

  play() {
    if (this.running || !this.animate) return
    this.running = true
    const loop = (now: number) => {
      if (!this.running) return
      this.draw(now)
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  private draw(now: number) {
    const gl = this.gl
    if (gl.isContextLost()) return
    const p = this.pointer
    p.x += (p.tx - p.x) * 0.04
    p.y += (p.ty - p.y) * 0.04
    const t = this.animate ? (now - this.start) / 1000 : 12.5
    // Calm mode shows a still, brightened crowd instead of a travelling wave.
    const pulse = !this.animate ? (this.staticLit ? 0.9 : 0) : this.pulseStart > 0 ? (now - this.pulseStart) / 1000 : 0
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.uniform1f(this.uniforms.uTime, t)
    gl.uniform1f(this.uniforms.uGlow, this.glow)
    gl.uniform1f(this.uniforms.uPulse, pulse > 4.4 ? 0 : pulse)
    gl.uniform2f(this.uniforms.uSize, this.canvas.width, this.canvas.height)
    gl.uniform1f(this.uniforms.uScale, this.reference() * this.dpr)
    gl.uniform1f(this.uniforms.uLead, this.lead * this.dpr)
    gl.uniform2f(this.uniforms.uPointer, p.x, p.y)
    gl.drawArrays(gl.POINTS, 0, this.count)
  }

  /**
   * Releases GPU resources but keeps the context alive: the same canvas is reused when
   * settings change, and a deliberately lost context could not be created again.
   */
  destroy() {
    this.stop()
    this.resizeObserver.disconnect()
    this.canvas.removeEventListener('webglcontextlost', this.handleLost)
    const gl = this.gl
    if (!gl.isContextLost()) {
      gl.deleteBuffer(this.buffer)
      this.shaders.forEach((s) => {
        gl.detachShader(this.program, s)
        gl.deleteShader(s)
      })
      gl.deleteProgram(this.program)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    }
  }
}

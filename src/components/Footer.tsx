import { FOOTER } from '../config/site'
import { Constellation } from './Constellation'

export function Footer() {
  return (
    <footer className="site-footer">
      <Constellation className="site-footer__mark" showBeyond={false} />
      <p className="site-footer__line">{FOOTER.line}</p>
    </footer>
  )
}

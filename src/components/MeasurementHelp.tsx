import { HelpTooltip } from './HelpTooltip.tsx';
import type { HelpContext } from './HelpTooltip.tsx';

export function MeasurementHelp(props: HelpContext) {
  return <HelpTooltip id="measurement-help" label="柜内净尺寸" action="查看测量方法" {...props}>
    <strong>测量柜内可用空间</strong>
    <svg className="measurement-diagram" viewBox="0 0 320 185" role="img" aria-label="柜体内部测量示意：W 为左右内壁之间的宽度，H 为底板至顶板的高度，D 为关门后内侧至背板的深度。">
      <defs><marker id="measure-arrow" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M7 4 1 1v6Z"/></marker></defs>
      <g className="cabinet-surfaces">
        <path className="cabinet-back" d="M116 28h160v94H116Z"/>
        <path className="cabinet-floor" d="m66 156 50-34h160l-50 34Z"/>
        <path className="cabinet-inside" d="m66 62 50-34v94l-50 34Z"/>
        <path className="cabinet-side" d="m236 52 50-34v114l-50 34Z"/>
        <path className="cabinet-top" d="m56 52 50-34h180l-50 34Z"/>
        <path className="cabinet-front" fillRule="evenodd" d="M56 52h180v114H56Zm10 10v94h160V62Z"/>
      </g>
      <g className="measure-lines"><path d="M80 143h133"/><path d="M80 73v58"/><path d="m238 142 28-20"/></g>
      <g className="measure-letters"><text x="147" y="134">W</text><text x="92" y="106">H</text><text x="249" y="124">D</text></g>
    </svg>
    <dl className="measurement-axes"><div><dt>宽 W</dt><dd>左右两侧内壁之间的距离。</dd></div><div><dt>高 H</dt><dd>底板上表面到顶板下表面的距离。</dd></div><div><dt>深 D</dt><dd>柜门关闭后的内侧到背板的距离。</dd></div></dl>
    <p>避开铰链、门框等凸起，多测几处，取最小值。直接填写实测值，柜边间隙会另行预留。</p>
  </HelpTooltip>;
}

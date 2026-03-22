import { useEffect, useRef } from "react";
import "./LandingPage.css";

interface LandingPageProps {
  onEnter: () => void;
}

export default function LandingPage({ onEnter }: LandingPageProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const scratchRef = useRef<SVGSVGElement>(null);
  const doodleRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const page = pageRef.current;
    const ss = scratchRef.current;
    const ds = doodleRef.current;
    if (!page || !ss || !ds) return;

    function rnd(a: number, b: number): number {
      return Math.random() * (b - a) + a;
    }

    function drawScratches() {
      const w = page!.offsetWidth;
      const h = page!.offsetHeight;
      ss!.innerHTML = "";

      for (let i = 0; i < 80; i++) {
        const x = rnd(0, w);
        const y = rnd(0, h);
        const len = rnd(6, 52);
        const a = rnd(-0.35, 0.35);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", String(x));
        l.setAttribute("y1", String(y));
        l.setAttribute("x2", String(x + Math.cos(a) * len));
        l.setAttribute("y2", String(y + Math.sin(a) * len));
        l.setAttribute("stroke", `rgba(255,255,255,${rnd(0.018, 0.08).toFixed(3)})`);
        l.setAttribute("stroke-width", rnd(0.3, 1.5).toFixed(1));
        l.setAttribute("stroke-linecap", "round");
        ss!.appendChild(l);
      }

      for (let i = 0; i < 25; i++) {
        const x = rnd(0, w);
        const y = rnd(0, h);
        const len = rnd(2, 12);
        const a = rnd(-0.1, 0.1);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", String(x));
        l.setAttribute("y1", String(y));
        l.setAttribute("x2", String(x + Math.cos(a) * len));
        l.setAttribute("y2", String(y + Math.sin(a) * len));
        l.setAttribute("stroke", `rgba(255,255,255,${rnd(0.04, 0.13).toFixed(3)})`);
        l.setAttribute("stroke-width", "2");
        l.setAttribute("stroke-linecap", "round");
        ss!.appendChild(l);
      }

      for (let i = 0; i < 10; i++) {
        const x = rnd(0, w);
        const y = rnd(0, h);
        const len = rnd(50, 120);
        const a = rnd(-0.06, 0.06);
        const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
        l.setAttribute("x1", String(x));
        l.setAttribute("y1", String(y));
        l.setAttribute("x2", String(x + Math.cos(a) * len));
        l.setAttribute("y2", String(y + Math.sin(a) * len));
        l.setAttribute("stroke", `rgba(255,255,255,${rnd(0.01, 0.035).toFixed(3)})`);
        l.setAttribute("stroke-width", "0.5");
        l.setAttribute("stroke-linecap", "round");
        ss!.appendChild(l);
      }

      for (let i = 0; i < 18; i++) {
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        c.setAttribute("cx", String(rnd(0, w)));
        c.setAttribute("cy", String(rnd(0, h)));
        c.setAttribute("r", rnd(0.4, 2.1).toFixed(1));
        c.setAttribute("fill", `rgba(255,255,255,${rnd(0.015, 0.07).toFixed(3)})`);
        ss!.appendChild(c);
      }
    }

    function pl(d: string, col: string, sw: string) {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", d);
      p.setAttribute("stroke", col);
      p.setAttribute("stroke-width", sw);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      ds!.appendChild(p);
    }

    function drawDoodles() {
      const w = page!.offsetWidth;
      const h = page!.offsetHeight;
      ds!.innerHTML = "";
      const wh = "rgba(253,249,240,0.2)";
      const gn = "rgba(232,228,194,0.32)";
      const yw = "rgba(232,228,194,0.26)";

      pl(
        `M 28 28 L 82 34 M 26 42 L 74 47 M 30 56 L 68 60 M 28 70 L 60 73 M 32 84 L 52 87`,
        wh,
        "1.3"
      );
      pl(`M 36 96 Q 54 88 46 104 Q 38 116 60 110 Q 76 104 68 120`, gn, "1.4");
      pl(`M 24 128 L 72 122 M 26 138 L 64 134 M 28 148 L 56 145`, wh, "1.2");
      pl(`M 30 160 Q 50 152 42 168 Q 34 182 56 176`, yw, "1.4");

      pl(
        `M ${w - 28} 28 L ${w - 82} 34 M ${w - 26} 42 L ${w - 74} 47 M ${w - 30} 56 L ${w - 68} 60 M ${w - 28} 70 L ${w - 60} 73 M ${w - 32} 84 L ${w - 52} 87`,
        wh,
        "1.3"
      );
      pl(
        `M ${w - 36} 96 Q ${w - 54} 88 ${w - 46} 104 Q ${w - 38} 116 ${w - 60} 110 Q ${w - 76} 104 ${w - 68} 120`,
        gn,
        "1.4"
      );
      pl(
        `M ${w - 24} 128 L ${w - 72} 122 M ${w - 26} 138 L ${w - 64} 134 M ${w - 28} 148 L ${w - 56} 145`,
        wh,
        "1.2"
      );
      pl(`M ${w - 30} 160 Q ${w - 50} 152 ${w - 42} 168 Q ${w - 34} 182 ${w - 56} 176`, yw, "1.4");

      pl(
        `M 28 ${h - 28} L 82 ${h - 34} M 26 ${h - 42} L 74 ${h - 47} M 30 ${h - 56} L 68 ${h - 60} M 28 ${h - 70} L 60 ${h - 73} M 32 ${h - 84} L 52 ${h - 87}`,
        wh,
        "1.3"
      );
      pl(
        `M 36 ${h - 96} Q 54 ${h - 88} 46 ${h - 104} Q 38 ${h - 116} 60 ${h - 110} Q 76 ${h - 104} 68 ${h - 120}`,
        gn,
        "1.4"
      );
      pl(`M 24 ${h - 128} L 72 ${h - 122} M 26 ${h - 138} L 64 ${h - 134}`, wh, "1.2");

      pl(
        `M ${w - 28} ${h - 28} L ${w - 82} ${h - 34} M ${w - 26} ${h - 42} L ${w - 74} ${h - 47} M ${w - 30} ${h - 56} L ${w - 68} ${h - 60} M ${w - 28} ${h - 70} L ${w - 60} ${h - 73} M ${w - 32} ${h - 84} L ${w - 52} ${h - 87}`,
        wh,
        "1.3"
      );
      pl(
        `M ${w - 36} ${h - 96} Q ${w - 54} ${h - 88} ${w - 46} ${h - 104} Q ${w - 38} ${h - 116} ${w - 60} ${h - 110} Q ${w - 76} ${h - 104} ${w - 68} ${h - 120}`,
        gn,
        "1.4"
      );
      pl(
        `M ${w - 24} ${h - 128} L ${w - 72} ${h - 122} M ${w - 26} ${h - 138} L ${w - 64} ${h - 134}`,
        wh,
        "1.2"
      );

      pl(`M 24 ${h * 0.44} L 46 ${h * 0.4} M 24 ${h * 0.5} L 42 ${h * 0.47} M 24 ${h * 0.56} L 38 ${h * 0.54}`, wh, "1.1");
      pl(
        `M ${w - 24} ${h * 0.44} L ${w - 46} ${h * 0.4} M ${w - 24} ${h * 0.5} L ${w - 42} ${h * 0.47} M ${w - 24} ${h * 0.56} L ${w - 38} ${h * 0.54}`,
        wh,
        "1.1"
      );

      pl(
        `M ${w * 0.28} 22 L ${w * 0.3} 32 M ${w * 0.34} 20 L ${w * 0.32} 34 M ${w * 0.38} 24 L ${w * 0.4} 16 M ${w * 0.43} 26 L ${w * 0.45} 18 M ${w * 0.48} 22 L ${w * 0.5} 30`,
        yw,
        "1.2"
      );
      pl(
        `M ${w * 0.52} 22 L ${w * 0.54} 32 M ${w * 0.56} 20 L ${w * 0.58} 34 M ${w * 0.6} 24 L ${w * 0.62} 16 M ${w * 0.65} 26 L ${w * 0.67} 18 M ${w * 0.7} 22 L ${w * 0.72} 30`,
        yw,
        "1.2"
      );

      pl(
        `M ${w * 0.28} ${h - 22} L ${w * 0.3} ${h - 32} M ${w * 0.34} ${h - 20} L ${w * 0.32} ${h - 34} M ${w * 0.38} ${h - 24} L ${w * 0.4} ${h - 16} M ${w * 0.43} ${h - 26} L ${w * 0.45} ${h - 18} M ${w * 0.48} ${h - 22} L ${w * 0.5} ${h - 30}`,
        gn,
        "1.2"
      );
      pl(
        `M ${w * 0.52} ${h - 22} L ${w * 0.54} ${h - 32} M ${w * 0.56} ${h - 20} L ${w * 0.58} ${h - 34} M ${w * 0.6} ${h - 24} L ${w * 0.62} ${h - 16} M ${w * 0.65} ${h - 26} L ${w * 0.67} ${h - 18} M ${w * 0.7} ${h - 22} L ${w * 0.72} ${h - 30}`,
        gn,
        "1.2"
      );
    }

    const timer = setTimeout(() => {
      drawScratches();
      drawDoodles();
    }, 60);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <svg className="scratch-svg" ref={scratchRef} xmlns="http://www.w3.org/2000/svg" />
      <svg className="doodle-svg" ref={doodleRef} xmlns="http://www.w3.org/2000/svg" />

      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />

      <div className="landing-content">
        <div>
          <div className="title-row">
            <h1 className="landing-title">Solvit!</h1>
            <span className="pen-icon">✐</span>
          </div>
          <svg width="310" height="16" viewBox="0 0 310 16" className="underline-svg" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 11 Q78 5 155 9 Q232 13 302 8" stroke="rgba(232,228,194,0.55)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M28 13 Q115 8 175 11 Q238 13 292 10" stroke="rgba(240,234,216,0.1)" strokeWidth="1" fill="none" strokeLinecap="round" />
          </svg>
        </div>

        <p className="landing-desc">
          Draw it. Solve it.<br />
          Where your drawings become solutions.
        </p>

        <button className="landing-cta" onClick={onEnter}>
          Get Solving!
        </button>
      </div>
    </div>
  );
}

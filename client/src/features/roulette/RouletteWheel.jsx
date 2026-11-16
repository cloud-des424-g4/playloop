import { useEffect, useRef, useState } from 'react';
import art from '../../assets/roulette/wheel.png';
import styles from './Roulette.module.css';
import { instantMotion, WEDGES } from './wheelMotion.js';

const STEP = 360 / WEDGES.length;

// Geometry in the artwork's own pixels (wheel.png is 1244 × 1210). The painted pointer and "SPIN"
// hub are part of the picture, so the disc is clipped inside the pointer's tip and the rim, pointer
// and hub are drawn here instead: that way the disc can turn while they stay still.
const CX = 620;
const CY = 596;
const FACE = 438;
const RIM = 458;
const HUB = 152;
const PEG = RIM;
const VIEW = `${CX - 500} ${CY - 575} 1000 1085`;

const CRUISE = 540; // degrees per second while waiting for the API
const MIN_CRUISE_MS = 700;
const MIN_COAST = 270; // degrees travelled while slowing down, at least

// The wedge to stop on: the game's first genre that is painted on the wheel, else any wedge.
function pickWedge(genres) {
  const index = WEDGES.findIndex((wedge) => genres?.includes(wedge));
  return index === -1
    ? { index: Math.floor(Math.random() * WEDGES.length), matched: false }
    : { index, matched: true };
}

// Rotation that puts a wedge under the pointer, a little off-centre so stops don't look staged.
const restAngle = (index) => -index * STEP + (Math.random() - 0.5) * STEP * 0.7;

const polar = (radius, degrees) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CX + radius * Math.cos(radians), CY + radius * Math.sin(radians)];
};

function wedgePath(index) {
  const [x1, y1] = polar(FACE, index * STEP - STEP / 2);
  const [x2, y2] = polar(FACE, index * STEP + STEP / 2);
  return `M${CX},${CY} L${x1},${y1} A${FACE},${FACE} 0 0 1 ${x2},${y2} Z`;
}

// The roulette wheel. While `spinning` it turns at a steady speed; once `landing` says where to stop
// ({ genres }) it slows down onto that wedge and calls onSettled. The server picks the game, the
// wheel only shows it.
export function RouletteWheel({ spinning, landing, onSettled }) {
  const disc = useRef(null);
  const pointer = useRef(null);
  const motion = useRef({ angle: 0, speed: 0 });
  const latest = useRef({ landing, onSettled });
  const [won, setWon] = useState(null);

  useEffect(() => {
    latest.current = { landing, onSettled };
  });

  useEffect(() => {
    if (!spinning) return undefined;
    const state = motion.current;

    // The pegs on the rim flick the pointer as they pass under it.
    const paint = () => {
      disc.current.style.transform = `rotate(${state.angle}deg)`;
      const sincePeg = (((state.angle - STEP / 2) % STEP) + STEP) % STEP;
      const flick = Math.max(0, 1 - sincePeg / 14) * Math.min(1, state.speed / 90);
      pointer.current.style.transform = `rotate(${flick * 22}deg)`;
    };
    const settle = (index, matched) => {
      state.speed = 0;
      paint();
      setWon(matched ? index : null);
      latest.current.onSettled();
    };

    let frameId;
    let previous = performance.now();
    const started = previous;
    let coast = null;

    const frame = (now) => {
      const dt = Math.min(0.05, (now - previous) / 1000);
      previous = now;
      const request = latest.current.landing;

      if (request && instantMotion()) {
        const { index, matched } = pickWedge(request.genres);
        state.angle = restAngle(index);
        settle(index, matched);
        return;
      }

      if (!coast) {
        state.speed += (CRUISE - state.speed) * Math.min(1, dt * 5);
        state.angle += state.speed * dt;
        if (request && now - started >= MIN_CRUISE_MS) {
          const picked = pickWedge(request.genres);
          let distance = (((restAngle(picked.index) - state.angle) % 360) + 360) % 360;
          while (distance < MIN_COAST) distance += 360;
          // Ease-out cubic starts at 3 × distance ÷ duration, so this duration keeps the speed
          // continuous at the moment the wheel starts to slow.
          const duration = (3 * distance) / Math.max(state.speed, 200);
          coast = { ...picked, from: state.angle, distance, duration, elapsed: 0 };
        }
      } else {
        coast.elapsed += dt;
        const progress = Math.min(1, coast.elapsed / coast.duration);
        const next = coast.from + coast.distance * (1 - (1 - progress) ** 3);
        state.speed = (next - state.angle) / dt;
        state.angle = next;
        if (progress === 1) {
          settle(coast.index, coast.matched);
          return;
        }
      }
      paint();
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, [spinning]);

  const highlighted = spinning ? won : null;

  return (
    <svg className={styles.wheel} viewBox={VIEW} aria-hidden="true">
      <defs>
        <clipPath id="roulette-face">
          <circle cx={CX} cy={CY} r={FACE} />
        </clipPath>
        <radialGradient id="roulette-hub" cx="0.38" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ff9a52" />
          <stop offset="0.55" stopColor="#fb541b" />
          <stop offset="1" stopColor="#d93a06" />
        </radialGradient>
        <linearGradient id="roulette-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff6e6" />
          <stop offset="1" stopColor="#f6cfa0" />
        </linearGradient>
      </defs>

      <ellipse className={styles.wheelShadow} cx={CX} cy={CY + RIM + 22} rx={RIM * 0.82} ry={26} />

      <g ref={disc} className={styles.disc}>
        <circle cx={CX} cy={CY} r={RIM} fill="url(#roulette-rim)" />
        <image href={art} x={0} y={0} width={1244} height={1210} clipPath="url(#roulette-face)" />
        <circle cx={CX} cy={CY} r={FACE} fill="none" stroke="#fff" strokeWidth={5} />
        {highlighted !== null && <path className={styles.winner} d={wedgePath(highlighted)} />}
        {WEDGES.map((wedge, i) => {
          const [x, y] = polar(PEG, i * STEP + STEP / 2);
          return <circle key={wedge} className={styles.peg} cx={x} cy={y} r={11} />;
        })}
      </g>

      <g className={styles.hub}>
        <circle cx={CX} cy={CY} r={HUB + 10} fill="#fff" />
        <circle cx={CX} cy={CY} r={HUB} fill="url(#roulette-hub)" />
        <text
          className={styles.hubText}
          x={CX}
          y={CY}
          textAnchor="middle"
          dominantBaseline="central"
        >
          SPIN
        </text>
      </g>

      <g ref={pointer} className={styles.pointer}>
        <path
          d={`M${CX},${CY - FACE + 44} C${CX - 20},${CY - FACE - 4} ${CX - 50},${CY - RIM - 24} ${CX - 50},${CY - RIM - 56} A50,50 0 1 1 ${CX + 50},${CY - RIM - 56} C${CX + 50},${CY - RIM - 24} ${CX + 20},${CY - FACE - 4} ${CX},${CY - FACE + 44} Z`}
          fill="#f0330a"
          stroke="#fff"
          strokeWidth={6}
        />
        <circle cx={CX} cy={CY - RIM - 56} r={20} fill="#fff" />
      </g>
    </svg>
  );
}

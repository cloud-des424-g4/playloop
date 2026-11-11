import { useId, useRef, useState } from 'react';
import { Button, Keycap, Tag, TextField } from '../../components/index.js';
import { cx } from '../../lib/cx.js';
import { RemoveButton } from '../forms/QuestionEditor.jsx';
import {
  ACCENT_SWATCHES,
  BACKGROUNDS,
  CONTROLS_SWATCHES,
  DEFAULT_THEME,
  HEX,
} from './gameTheme.js';
import { BUILD_TARGETS, LIMITS } from './editorModel.js';
import styles from './GameEditor.module.css';

const MEDIA_TYPES = { 'image/png': 5, 'image/jpeg': 5, 'video/mp4': 100 };

function filePicker(ref, accept, onFiles, multiple = false) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={multiple}
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        onFiles([...e.target.files]);
        e.target.value = '';
      }}
    />
  );
}

// Media (257:878): drop zone while empty, then the cover and thumbnails. The first image is the
// cover on game cards.
export function MediaEditor({ media, onAdd, onRemove, onCover, busy }) {
  const input = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState(0);
  const [problem, setProblem] = useState('');
  const current = media[selected] ?? media[0];
  function take(files) {
    const room = LIMITS.media - media.length;
    const accepted = files.slice(0, room).filter((file) => {
      const maxMb = MEDIA_TYPES[file.type];
      return maxMb && file.size <= maxMb * 1024 * 1024;
    });
    setProblem(
      accepted.length < files.length
        ? 'Some files were skipped: use PNG or JPG up to 5 MB, MP4 up to 100 MB, 8 files at most.'
        : '',
    );
    if (accepted.length) onAdd(accepted);
  }
  const browse = () => input.current.click();
  return (
    <section className={cx(styles.panel, styles.media)} aria-label="Screenshots and videos">
      <div
        className={cx(styles.dropzone, dragging && styles.dragging, current && styles.hasMedia)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          take([...e.dataTransfer.files]);
        }}
      >
        {current ? (
          <>
            {current.type === 'video' ? (
              <video src={current.url} controls className={styles.mediaFill} />
            ) : (
              <img src={current.url} alt="Selected screenshot" className={styles.mediaFill} />
            )}
            <div className={styles.mediaActions}>
              {media[0]?.id !== current.id && current.type === 'image' && (
                <Button variant="glass" disabled={busy} onClick={() => onCover(current.id)}>
                  Make cover
                </Button>
              )}
              <Button variant="pink" disabled={busy} onClick={() => onRemove(current.id)}>
                Remove
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.dropTitle}>Drag screenshots or a video here</p>
            <Button variant="glass" disabled={busy} onClick={browse}>
              Browse files
            </Button>
            <p className={styles.caption}>
              PNG or JPG up to 5 MB each · MP4 up to 100 MB · up to 8 files
            </p>
            <p className={styles.caption}>The first image becomes the cover on game cards.</p>
            <p className={styles.warning}>Add at least one screenshot to publish.</p>
          </>
        )}
      </div>
      <ul className={styles.thumbs}>
        {media.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              className={cx(styles.thumb, item.id === current?.id && styles.thumbSelected)}
              aria-pressed={item.id === current?.id}
              aria-label={`${item.type === 'video' ? 'Video' : 'Screenshot'} ${i + 1}${i === 0 ? ' (cover)' : ''}`}
              onClick={() => setSelected(i)}
            >
              {item.type === 'video' ? (
                <video src={item.url} muted />
              ) : (
                <img src={item.url} alt="" />
              )}
              {i === 0 && <span className={styles.coverBadge}>Cover</span>}
            </button>
          </li>
        ))}
        {media.length < LIMITS.media &&
          Array.from({ length: Math.max(1, 4 - media.length) }, (_, i) => (
            <li key={`add-${i}`}>
              <button type="button" className={styles.addSlot} disabled={busy} onClick={browse}>
                + Add
              </button>
            </li>
          ))}
      </ul>
      {filePicker(input, Object.keys(MEDIA_TYPES).join(','), take, true)}
      {problem && <p className={styles.warning}>{problem}</p>}
    </section>
  );
}

// A list of short text fields with "+ Add bullet" (Core Gameplay, What's playable).
export function BulletList({ label, items, onChange, max, min = 0 }) {
  return (
    <div className={styles.bullets}>
      {items.map((item, i) => (
        <div key={i} className={styles.bulletRow}>
          <TextField
            label={`${label} ${i + 1}`}
            className={styles.hiddenLabel}
            placeholder={i >= min ? 'Add a bullet (optional)' : ''}
            maxLength={LIMITS.bullet}
            value={item}
            onChange={(e) => onChange(items.map((v, j) => (j === i ? e.target.value : v)))}
          />
          {items.length > Math.max(min, 1) && (
            <RemoveButton
              label={`Remove ${label.toLowerCase()} ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            />
          )}
        </div>
      ))}
      {items.length < max && (
        <button type="button" className={styles.addLink} onClick={() => onChange([...items, ''])}>
          + Add bullet
        </button>
      )}
    </div>
  );
}

// Tags with × and an inline field to add one (content warnings).
export function TagListEditor({ label, items, onChange, max, maxLength, tone }) {
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  function add(event) {
    event.preventDefault();
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft('');
    setAdding(false);
  }
  return (
    <div className={styles.tagList}>
      {items.map((item) => (
        <button
          key={item}
          type="button"
          className={styles.removableTag}
          aria-label={`Remove ${item}`}
          onClick={() => onChange(items.filter((v) => v !== item))}
        >
          <Tag tone={tone}>{item} ×</Tag>
        </button>
      ))}
      {adding ? (
        <form className={styles.inlineAdd} onSubmit={add}>
          <TextField
            label={label}
            className={styles.hiddenLabel}
            autoFocus
            maxLength={maxLength}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button variant="glass" type="submit">
            Add
          </Button>
        </form>
      ) : (
        items.length < max && (
          <button type="button" className={styles.addLink} onClick={() => setAdding(true)}>
            + Add
          </button>
        )
      )}
    </div>
  );
}

// Controls card (263:561): a keycap-like field for the key and a field for what it does.
export function ControlsEditor({ controls, onChange }) {
  const set = (i, patch) => onChange(controls.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <div className={styles.controlRows}>
      {controls.map((control, i) => (
        <div key={i} className={styles.controlRow}>
          <label className={styles.keyField}>
            <span className="visually-hidden">Key {i + 1}</span>
            <Keycap className={styles.keyInputWrap}>
              <input
                className={styles.keyInput}
                maxLength={20}
                placeholder="Key"
                value={control.key}
                onChange={(e) => set(i, { key: e.target.value })}
              />
            </Keycap>
          </label>
          <TextField
            label={`Action ${i + 1}`}
            className={styles.hiddenLabel}
            placeholder="What it does"
            maxLength={40}
            value={control.action}
            onChange={(e) => set(i, { action: e.target.value })}
          />
          <RemoveButton
            label={`Remove control ${i + 1}`}
            onClick={() => onChange(controls.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {controls.length < LIMITS.controls && (
        <button
          type="button"
          className={styles.addLink}
          onClick={() => onChange([...controls, { key: '', action: '' }])}
        >
          + Add control
        </button>
      )}
    </div>
  );
}

export function CreditsEditor({ credits, onChange }) {
  const set = (i, patch) => onChange(credits.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <section className={cx(styles.panel, styles.credits)} aria-label="Credits">
      {credits.map((credit, i) => (
        <div key={i} className={styles.credit}>
          <TextField
            label="Role"
            placeholder="Design & Programming"
            maxLength={40}
            value={credit.role}
            onChange={(e) => set(i, { role: e.target.value })}
          />
          <TextField
            label="Name or studio"
            maxLength={60}
            value={credit.name}
            onChange={(e) => set(i, { name: e.target.value })}
          />
          <RemoveButton
            label={`Remove credit ${i + 1}`}
            onClick={() => onChange(credits.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      {credits.length < LIMITS.credits && (
        <button
          type="button"
          className={cx(styles.addLink, styles.addCredit)}
          onClick={() => onChange([...credits, { role: '', name: '' }])}
        >
          + Add credit
        </button>
      )}
    </section>
  );
}

function Swatches({ label, swatches, value, onChange }) {
  const id = useId();
  const [hex, setHex] = useState('');
  return (
    <div className={styles.swatchRow} role="radiogroup" aria-labelledby={id}>
      <span id={id} className="visually-hidden">
        {label}
      </span>
      {swatches.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value.toUpperCase() === color}
          aria-label={color}
          className={styles.swatch}
          style={{ '--swatch': color }}
          onClick={() => onChange(color)}
        />
      ))}
      <TextField
        label={`${label} hex`}
        className={cx(styles.hiddenLabel, styles.hexField)}
        placeholder="#hex"
        maxLength={7}
        value={hex}
        onChange={(e) => {
          setHex(e.target.value);
          if (HEX.test(e.target.value)) onChange(e.target.value.toUpperCase());
        }}
      />
    </div>
  );
}

// Page options (265:590): background preset or image, accent and controls card colours.
export function PageOptions({ theme, imageUrl, onChange, onUploadBackground, busy }) {
  const input = useRef(null);
  const set = (patch) => onChange({ ...theme, ...patch });
  return (
    <section className={cx(styles.panel, styles.pageOptions)} aria-labelledby="page-options">
      <h2 id="page-options" className={styles.sectionTitle}>
        Page options
      </h2>
      <p className={styles.body}>
        Change how your public game page looks. The site header, logo and Log In button stay the
        same on every page.
      </p>
      <div className={styles.optionsRow}>
        <div className={styles.optionGroup}>
          <h3 className={styles.groupTitle}>Background</h3>
          <div className={styles.presets} role="radiogroup" aria-label="Background">
            {BACKGROUNDS.map((bg) => {
              const checked = theme.backgroundPreset === bg.preset;
              return (
                <button
                  key={bg.preset}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  className={styles.preset}
                  onClick={() => set({ backgroundPreset: bg.preset })}
                >
                  <span className={styles.presetThumb} style={{ background: bg.background }} />
                  <span className={styles.presetLabel}>{bg.label}</span>
                </button>
              );
            })}
            {imageUrl && !theme.backgroundPreset && (
              <span className={styles.preset} aria-current="true">
                <span
                  className={styles.presetThumb}
                  style={{ background: `center / cover url("${imageUrl}")` }}
                />
                <span className={styles.presetLabel}>Your image</span>
              </span>
            )}
          </div>
          <div className={styles.uploadRow}>
            <Button variant="glass" disabled={busy} onClick={() => input.current.click()}>
              Upload image
            </Button>
            <p className={styles.caption}>JPG or PNG, at least 1920 × 1080, max 5 MB</p>
          </div>
          {filePicker(input, 'image/png,image/jpeg', ([file]) => file && onUploadBackground(file))}
        </div>
        <div className={styles.optionGroup}>
          <h3 className={styles.groupTitle}>Color palette</h3>
          <p className={styles.swatchLabel}>Page accent</p>
          <Swatches
            label="Page accent"
            swatches={ACCENT_SWATCHES}
            value={theme.accentColor}
            onChange={(accentColor) => set({ accentColor })}
          />
          <p className={styles.caption}>
            Used on buttons, corner markers, the selected screenshot, the scrollbar and the pitch
            bar.
          </p>
          <p className={styles.swatchLabel}>Controls card</p>
          <Swatches
            label="Controls card"
            swatches={CONTROLS_SWATCHES}
            value={theme.controlsCardColor}
            onChange={(controlsCardColor) => set({ controlsCardColor })}
          />
          <p className={styles.caption}>
            Text colors adjust automatically so everything stays readable.
          </p>
        </div>
      </div>
      <button
        type="button"
        className={styles.addLink}
        onClick={() =>
          onChange({
            backgroundPreset: DEFAULT_THEME.backgroundPreset,
            accentColor: DEFAULT_THEME.accentColor,
            controlsCardColor: DEFAULT_THEME.controlsCardColor,
          })
        }
      >
        Reset to PlayLoop default
      </button>
    </section>
  );
}

const BUILD_STATUS = {
  processing: 'Processing…',
  ready: 'Uploaded',
  failed: 'Failed',
};

function BuildFile({ build, accept, onUpload, busy, label }) {
  const input = useRef(null);
  return (
    <div className={styles.buildRow}>
      <div className={styles.buildFile}>
        <span className={styles.buildName}>{build ? build.fileName : label}</span>
        <span className={cx(styles.caption, build?.status === 'failed' && styles.warning)}>
          {build
            ? `${BUILD_STATUS[build.status]}${build.error ? ` · ${build.error}` : ''}`
            : 'No file yet'}
        </span>
      </div>
      <Button variant="glass" disabled={busy} onClick={() => input.current.click()}>
        {build ? 'Replace' : 'Upload'}
      </Button>
      {filePicker(input, accept, ([file]) => file && onUpload(file))}
    </div>
  );
}

// "How players get your game" (265:676). Web builds are zips extracted on the server; a link can
// be used instead. Download builds are one file per system.
export function GameFileSection({ delivery, builds, onChange, onUploadBuild, busy }) {
  const web = builds.find((b) => b.target === 'web');
  const options = [
    [
      'web',
      'Play in browser',
      'Reviewers play right here on PlayLoop. Upload a web build or paste a link.',
    ],
    [
      'download',
      'Download required',
      'Reviewers download and run your build. Upload one file per system.',
    ],
  ];
  return (
    <section className={cx(styles.panel, styles.gameFile)} aria-labelledby="game-file">
      <h2 id="game-file" className={styles.sectionTitle}>
        How players get your game *
      </h2>
      <div className={styles.deliveryOptions} role="radiogroup" aria-labelledby="game-file">
        {options.map(([method, title, text]) => {
          const checked = delivery.method === method;
          return (
            <div
              key={method}
              className={cx(styles.deliveryOption, checked && styles.deliveryChecked)}
            >
              <label className={styles.deliveryHead}>
                <input
                  type="radio"
                  name="delivery"
                  className={styles.radio}
                  checked={checked}
                  onChange={() => onChange({ ...delivery, method })}
                />
                {title}
              </label>
              <p className={styles.deliveryText}>{text}</p>
              <fieldset disabled={!checked || busy} className={styles.deliveryFields}>
                {method === 'web' ? (
                  <>
                    <BuildFile
                      build={web}
                      label="Web build (.zip)"
                      accept=".zip,application/zip"
                      onUpload={(file) => onUploadBuild('web', file)}
                      busy={busy}
                    />
                    <p className={styles.caption}>
                      .zip with index.html at the top, max 500 MB · or paste a link instead
                    </p>
                    <TextField
                      label="Link to your web build"
                      className={styles.hiddenLabel}
                      type="url"
                      placeholder="https://"
                      maxLength={500}
                      value={delivery.webUrl}
                      onChange={(e) => onChange({ ...delivery, webUrl: e.target.value })}
                    />
                  </>
                ) : (
                  <>
                    {BUILD_TARGETS.map(([target, name]) => (
                      <BuildFile
                        key={target}
                        build={builds.find((b) => b.target === target)}
                        label={name}
                        accept=".zip,.exe,.dmg,.gz,.tgz"
                        onUpload={(file) => onUploadBuild(target, file)}
                        busy={busy}
                      />
                    ))}
                    <p className={styles.caption}>.zip, .exe, .dmg or .tar.gz, max 2 GB each</p>
                  </>
                )}
              </fieldset>
            </div>
          );
        })}
      </div>
    </section>
  );
}

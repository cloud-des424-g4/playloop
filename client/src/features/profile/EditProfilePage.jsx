import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Avatar,
  Button,
  CheckboxField,
  PrimaryButton,
  Select,
  Tag,
  TextField,
  Textarea,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { toneForGenre } from '../../lib/tagTones.js';
import { uploadFile } from '../../lib/upload.js';
import { RemoveButton } from '../forms/QuestionEditor.jsx';
import { FALLBACK_OPTIONS, optionLabel } from '../explore/exploreQuery.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import featureStyles from '../shared/Features.module.css';
import { useResource } from '../shared/useResource.js';
import styles from './Profile.module.css';

const AVATAR_TYPES = ['image/png', 'image/jpeg'];
const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const MAX_GENRES = 5;
const MAX_LINKS = 5;

const errorText = (err) =>
  err.details?.length
    ? `${err.message}: ${err.details.map((d) => d.message).join(', ')}.`
    : err.message;

// Edit profile. Figma: "edit profile" (210:300). Usernames can't change (PATCH /me), so the field is
// read-only, and platforms follow the API (Web, PC, Mac, Mobile) rather than Figma's Console.
export function EditProfilePage() {
  const me = useResource('/me');
  const meta = useResource('/meta');
  const options = meta.data ?? (meta.error ? FALLBACK_OPTIONS : null);
  return (
    <RequestState resource={me}>
      {me.data && <ProfileForm me={me.data} options={options} />}
    </RequestState>
  );
}

function ProfileForm({ me, options }) {
  const navigate = useNavigate();
  const fileInput = useRef(null);
  const [form, setForm] = useState(() => ({
    displayName: me.displayName,
    pronouns: me.pronouns ?? '',
    bio: me.bio ?? '',
    favoriteGenres: [...me.favoriteGenres],
    platforms: [...me.platforms],
    links: me.links.map((link) => ({ ...link })),
  }));
  const [avatar, setAvatar] = useState({ url: me.avatarUrl, uploadId: undefined });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const profilePath = `/users/${me.username}`;
  const genreLabels = new Map((options?.genres ?? []).map((g) => [g.key, g.label]));
  const genreLabel = (key) => genreLabels.get(key) ?? optionLabel(key);
  const availableGenres = (options?.genres ?? []).filter(
    (g) => !form.favoriteGenres.includes(g.key),
  );

  async function changePhoto(file) {
    if (!file) return;
    if (!AVATAR_TYPES.includes(file.type) || file.size > AVATAR_MAX_BYTES) {
      setError('Use a JPG or PNG photo up to 2 MB.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const upload = await uploadFile({ purpose: 'avatar', file });
      setAvatar({ url: upload.url, uploadId: upload.id });
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (!form.displayName.trim()) {
      setError('Add a display name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.patch('/me', {
        displayName: form.displayName.trim(),
        pronouns: form.pronouns.trim() || null,
        bio: form.bio.trim(),
        favoriteGenres: form.favoriteGenres,
        platforms: form.platforms,
        links: form.links
          .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
          .filter((link) => link.label && link.url),
        ...(avatar.uploadId && { avatarUploadId: avatar.uploadId }),
      });
      navigate(profilePath);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const setLink = (i, patch) =>
    update({ links: form.links.map((link, j) => (j === i ? { ...link, ...patch } : link)) });

  return (
    <form className={styles.page} onSubmit={save}>
      <h1 className={featureStyles.title}>EDIT PROFILE</h1>
      <div className={styles.editLayout}>
        <div className={styles.photoCard}>
          <Avatar src={avatar.url} name={form.displayName} size={240} />
          <Button variant="glass" disabled={busy} onClick={() => fileInput.current.click()}>
            Change photo
          </Button>
          <p className={styles.photoHint}>
            JPG or PNG
            <br />
            Max. 2 MB
          </p>
          <input
            ref={fileInput}
            type="file"
            accept={AVATAR_TYPES.join(',')}
            className="visually-hidden"
            tabIndex={-1}
            aria-label="Profile photo"
            onChange={(e) => {
              changePhoto(e.target.files[0]);
              e.target.value = '';
            }}
          />
        </div>

        <div className={styles.formColumn}>
          <fieldset className={styles.formPanel} disabled={busy}>
            <div className={styles.nameRow}>
              <TextField
                label="Display name"
                maxLength={40}
                required
                value={form.displayName}
                onChange={(e) => update({ displayName: e.target.value })}
              />
              <TextField
                label="Pronouns"
                maxLength={20}
                placeholder="she/her"
                value={form.pronouns}
                onChange={(e) => update({ pronouns: e.target.value })}
              />
            </div>
            <TextField
              label="Username"
              value={`@${me.username}`}
              readOnly
              hint="Usernames can’t be changed."
            />
            <Textarea
              label="Bio"
              rows={3}
              maxLength={200}
              hint={`${form.bio.length}/200 characters`}
              value={form.bio}
              onChange={(e) => update({ bio: e.target.value })}
            />

            <div className={styles.group}>
              <p className={styles.caption} id="profile-genres">
                Game genres
              </p>
              <div className={styles.genreRow} aria-labelledby="profile-genres" role="group">
                {form.favoriteGenres.map((genre) => (
                  <button
                    key={genre}
                    type="button"
                    className={styles.removableTag}
                    aria-label={`Remove ${genreLabel(genre)}`}
                    onClick={() =>
                      update({ favoriteGenres: form.favoriteGenres.filter((g) => g !== genre) })
                    }
                  >
                    <Tag tone={toneForGenre(genre)}>{genreLabel(genre)} ×</Tag>
                  </button>
                ))}
                {form.favoriteGenres.length < MAX_GENRES && availableGenres.length > 0 && (
                  <Select
                    aria-label="Add genre"
                    className={styles.addSelect}
                    placeholder="+ Add genre"
                    value=""
                    options={availableGenres.map((g) => ({ value: g.key, label: g.label }))}
                    onChange={(e) =>
                      e.target.value &&
                      update({ favoriteGenres: [...form.favoriteGenres, e.target.value] })
                    }
                  />
                )}
              </div>
            </div>

            <fieldset className={styles.group}>
              <legend className={styles.caption}>Platforms</legend>
              <div className={styles.platformRow}>
                {(options?.platforms ?? []).map((platform) => (
                  <CheckboxField
                    key={platform}
                    label={optionLabel(platform)}
                    checked={form.platforms.includes(platform)}
                    onChange={() =>
                      update({
                        platforms: form.platforms.includes(platform)
                          ? form.platforms.filter((p) => p !== platform)
                          : [...form.platforms, platform],
                      })
                    }
                  />
                ))}
              </div>
            </fieldset>

            <div className={styles.group}>
              <h2 className={styles.linksTitle}>Links</h2>
              {form.links.map((link, i) => (
                <div key={i} className={styles.linkRow}>
                  <TextField
                    label="Label"
                    placeholder="Website"
                    maxLength={30}
                    value={link.label}
                    onChange={(e) => setLink(i, { label: e.target.value })}
                  />
                  <TextField
                    label="URL"
                    type="url"
                    placeholder="https://"
                    maxLength={500}
                    value={link.url}
                    onChange={(e) => setLink(i, { url: e.target.value })}
                  />
                  <RemoveButton
                    label={`Remove link ${i + 1}`}
                    onClick={() => update({ links: form.links.filter((_, j) => j !== i) })}
                  />
                </div>
              ))}
              {form.links.length < MAX_LINKS && (
                <button
                  type="button"
                  className={styles.addLink}
                  onClick={() => update({ links: [...form.links, { label: '', url: '' }] })}
                >
                  + Add link
                </button>
              )}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className={featureStyles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="glass" disabled={busy} onClick={() => navigate(profilePath)}>
              Cancel
            </Button>
            <PrimaryButton size="md" type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Save Changes'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </form>
  );
}

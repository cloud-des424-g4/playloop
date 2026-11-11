import { useState } from 'react';
import {
  Button,
  GlassPanel,
  PrimaryButton,
  Tag,
  Textarea,
  TextField,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { Pagination, RequestState, Reviewer } from '../shared/FeatureUI.jsx';
import { date, nameOf } from '../shared/format.js';
import { useResource } from '../shared/useResource.js';
import heart from '../../assets/icons/heart.svg';
import replyIcon from '../../assets/features/reply.svg';
import styles from '../shared/Features.module.css';

export function Discussion({ reviewId, onReply, compact = false }) {
  const [page, setPage] = useState(1);
  const resource = useResource(`/reviews/${reviewId}/replies?page=${page}&limit=20`);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function post(event) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    setError('');
    setSent(false);
    try {
      await api.post(`/reviews/${reviewId}/replies`, { body: body.trim() });
      setBody('');
      setSent(true);
      resource.refresh();
      onReply?.();
    } catch (err) {
      setError(err.status === 401 ? 'Log in to join the discussion.' : err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.stack} aria-label="Discussion">
      <h2 className={styles.sectionTitle}>Discussion</h2>
      <RequestState resource={resource}>
        <GlassPanel className={compact ? styles.compactDiscussion : undefined}>
          {resource.data?.items.length === 0 && (
            <p className={styles.caption}>No replies yet. Start the conversation.</p>
          )}
          {resource.data?.items.map((reply) => (
            <Reply
              key={reply.id}
              reply={reply}
              onReply={() => {
                setBody(`@${reply.author.username || nameOf(reply.author)} `);
                document.getElementById(`reply-${reviewId}`)?.focus();
              }}
            />
          ))}
        </GlassPanel>
        <Pagination data={resource.data} page={page} setPage={setPage} />
      </RequestState>
      <GlassPanel as="form" onSubmit={post} className={styles.stack}>
        {compact ? (
          <div className={styles.compactReply}>
            <TextField
              id={`reply-${reviewId}`}
              label="Reply to reviewer"
              placeholder="Write a reply…"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSent(false);
              }}
              maxLength={1000}
              required
            />
            <PrimaryButton size="md" type="submit" disabled={busy || !body.trim()}>
              {busy ? 'Sending…' : 'Send reply'}
            </PrimaryButton>
          </div>
        ) : (
          <>
            <Textarea
              id={`reply-${reviewId}`}
              label="Write a comment"
              placeholder="Share your thoughts…"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setSent(false);
              }}
              maxLength={1000}
              rows={3}
              required
            />
            <div className={styles.between}>
              <span className={styles.caption}>{body.length}/1000</span>
              <PrimaryButton size="md" type="submit" disabled={busy || !body.trim()}>
                {busy ? 'Posting…' : 'Post Comment'}
              </PrimaryButton>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {sent && <p role="status">Your reply was posted.</p>}
      </GlassPanel>
    </section>
  );
}
function Reply({ reply, onReply }) {
  const [reactions, setReactions] = useState(reply.reactions || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const heartReaction = reactions.find((reaction) => reaction.emoji === 'heart');
  async function react() {
    setBusy(true);
    setError('');
    try {
      const result = await api[heartReaction?.reactedByMe ? 'delete' : 'put'](
        `/reactions/reply/${reply.id}/heart`,
      );
      setReactions(result.reactions);
    } catch (err) {
      setError(err.status === 401 ? 'Log in to react to a reply.' : err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={styles.reply}>
      <div className={styles.between}>
        <Reviewer user={reply.author} subtitle={date(reply.createdAt)} size={48} />
        {reply.isGameOwner && <Tag tone="sky">Developer</Tag>}
        {reply.isReviewAuthor && <Tag tone="sunny">Reviewer</Tag>}
      </div>
      <p>{reply.body}</p>
      <div className={styles.row}>
        <button
          className={styles.action}
          disabled={busy}
          aria-label="Like reply"
          aria-pressed={Boolean(heartReaction?.reactedByMe)}
          onClick={react}
        >
          <img src={heart} alt="" width={19} height={19} />
          {heartReaction?.count || 0}
        </button>
        <Button variant="glass" onClick={onReply}>
          <span className={styles.action}>
            <img src={replyIcon} alt="" />
            Reply
          </span>
        </Button>
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}

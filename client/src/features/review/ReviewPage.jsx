import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, Playtime } from '../../components/index.js';
import { usePageLook } from '../../components/layout/pageLook.js';
import { api } from '../../lib/api.js';
import { themeLook } from '../games/gameTheme.js';
import { RequestState } from '../shared/FeatureUI.jsx';
import featureStyles from '../shared/Features.module.css';
import { FinalVerdictStep } from './FinalVerdictStep.jsx';
import { PlaytestStep } from './PlaytestStep.jsx';
import { ReviewHeaderActions } from './ReviewLayout.jsx';
import { ReviewSummary } from './ReviewSummary.jsx';
import { QuestionStep } from './ReviewUI.jsx';
import {
  VERDICT_FIELDS,
  answerFor,
  answersPayload,
  canLeave,
  isAnswered,
  ownerName,
  resumeView,
  verdictProblem,
  withAnswer,
} from './reviewModel.js';
import styles from './Review.module.css';

const PLAYTIME_SAVE_SECONDS = 30;

// "Review a game" (Figma 281:685 onwards). POST /games/:gameId/reviews starts a review or resumes
// the reviewer's draft for this game version.
export function ReviewPage() {
  const { gameId } = useParams();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({});
  const request = useRef(null);
  const key = `${gameId}:${attempt}`;
  useEffect(() => {
    // StrictMode runs effects twice in development; keep it to one POST per attempt.
    if (request.current?.key !== key) {
      request.current = { key, promise: api.post(`/games/${gameId}/reviews`) };
    }
    let live = true;
    request.current.promise.then(
      (review) => live && setResult({ key, review }),
      (error) => live && setResult({ key, error }),
    );
    return () => {
      live = false;
    };
  }, [gameId, key]);
  const current = result.key === key ? result : {};
  const resource = {
    loading: !current.review && !current.error,
    error: current.error,
    refresh: () => setAttempt((n) => n + 1),
  };
  return (
    <RequestState resource={resource}>
      {current.review && (
        <ReviewFlow key={current.review.id} initial={current.review} gameId={gameId} />
      )}
    </RequestState>
  );
}

const pickVerdict = (stage) =>
  Object.fromEntries(
    VERDICT_FIELDS.filter((f) => stage[f] !== undefined).map((f) => [f, stage[f]]),
  );

// The API rejects empty strings, and "other" text only goes with the Other category.
function verdictPayload(verdict) {
  const fields = Object.fromEntries(
    Object.entries(verdict).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  if (fields.improveCategory !== 'other') delete fields.improveOther;
  return fields;
}

function ReviewFlow({ initial, gameId }) {
  const navigate = useNavigate();
  const [review, setReview] = useState(initial);
  const [view, setView] = useState(() => resumeView(initial));
  const [editing, setEditing] = useState(false);
  const [fiAnswers, setFiAnswers] = useState(initial.firstImpression.answers);
  const [devAnswers, setDevAnswers] = useState(initial.developerAnswers.answers);
  const [verdict, setVerdict] = useState(() => pickVerdict(initial.finalVerdict));
  const [played, setPlayed] = useState(initial.playtest.playedSeconds);
  const [playing, setPlaying] = useState(
    initial.deliveryMethod === 'web' || initial.playtest.acceptedMissionIds.length > 0,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  const { id, form } = review;
  // The game's theme (background, accent, controls card) carries through every review screen.
  const theme = review.game.theme;
  const look = useMemo(() => themeLook(theme), [theme]);
  usePageLook(look);
  const fiQuestions = form.firstImpression.questions;
  const devQuestions = form.playtest.questions;
  const timing = view.step === 'playtest' && playing;

  // Playtime counts while the playtest is open and the tab is visible, and is saved every 30 s.
  useEffect(() => {
    if (!timing) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setPlayed((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timing]);
  const savedPlaytime = useRef(initial.playtest.playedSeconds);
  useEffect(() => {
    if (!timing || played - savedPlaytime.current < PLAYTIME_SAVE_SECONDS) return;
    savedPlaytime.current = played;
    api.put(`/reviews/${id}/playtest`, { playedSeconds: played }).catch(() => {});
  }, [timing, played, id]);

  async function run(task) {
    setBusy(true);
    setError('');
    try {
      await task();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function go(next) {
    setError('');
    setLeaving(false);
    setView(next);
    document.body.scrollIntoView?.();
  }
  const updateStage = (name) => (stage) => setReview((r) => ({ ...r, [name]: stage }));
  const verdictStart = () => ({
    step: 'final_verdict',
    index: form.finalVerdict.farewellMessage ? 'farewell' : 'intro',
  });
  function finishSection(next) {
    if (editing) {
      setEditing(false);
      go({ step: 'summary' });
    } else go(next);
  }

  const saveFirstImpression = (complete) =>
    api
      .put(`/reviews/${id}/first-impression`, {
        answers: answersPayload(fiQuestions, fiAnswers),
        complete,
      })
      .then(updateStage('firstImpression'));
  const saveDeveloperAnswers = (complete) =>
    api
      .put(`/reviews/${id}/developer-answers`, {
        answers: answersPayload(devQuestions, devAnswers),
        complete,
      })
      .then(updateStage('developerAnswers'));
  const savePlaytime = (extra) =>
    api.put(`/reviews/${id}/playtest`, { playedSeconds: played, ...extra }).then((stage) => {
      savedPlaytime.current = played;
      updateStage('playtest')(stage);
    });

  // First Impression and the developer's questions: one question per screen. Answers are saved on
  // every Next; the last Next completes the section.
  function questionNext(section) {
    const firstImpression = section === 'first_impression';
    const questions = firstImpression ? fiQuestions : devQuestions;
    const answers = firstImpression ? fiAnswers : devAnswers;
    const question = questions[view.index];
    if (question?.required && !isAnswered(question, answerFor(answers, question.id))) {
      setError('Answer this question to continue.');
      return;
    }
    const last = view.index >= questions.length - 1;
    const save = firstImpression ? saveFirstImpression : saveDeveloperAnswers;
    run(() => save(last)).then((saved) => {
      if (!saved) return;
      if (!last) go({ step: section, index: view.index + 1 });
      else if (firstImpression) finishSection({ step: 'playtest' });
      else finishSection(verdictStart());
    });
  }

  function verdictNext() {
    const step = view.index;
    if (step === 'farewell') return go({ step: 'final_verdict', index: 'intro' });
    if (step === 'intro') return go({ step: 'final_verdict', index: 1 });
    const problem = verdictProblem(step, verdict);
    if (problem) return setError(problem);
    const last = step === 4;
    const fields = verdictPayload(verdict);
    if (!last && !Object.keys(fields).length) return go({ step: 'final_verdict', index: step + 1 });
    run(() =>
      api
        .put(`/reviews/${id}/final-verdict`, { ...fields, complete: last })
        .then(updateStage('finalVerdict')),
    ).then((saved) => {
      if (!saved) return;
      if (last) {
        setEditing(false);
        go({ step: 'summary' });
      } else go({ step: 'final_verdict', index: step + 1 });
    });
  }

  function edit(section) {
    setEditing(section !== 'final_verdict');
    if (section === 'first_impression') go({ step: 'first_impression', index: 0 });
    else if (section === 'playtest') go({ step: 'playtest' });
    else go({ step: 'final_verdict', index: 1 });
  }

  async function saveAndLeave() {
    const saved = await run(async () => {
      if (view.step === 'first_impression') await saveFirstImpression(false);
      if (view.step === 'developer_questions') await saveDeveloperAnswers(false);
      if (view.step === 'playtest' && playing) await savePlaytime();
    });
    if (saved) navigate(`/games/${gameId}`);
  }
  async function discard() {
    const deleted = await run(() => api.delete(`/reviews/${id}`));
    if (deleted) navigate(`/games/${gameId}`);
  }

  let screen;
  if (view.step === 'first_impression') {
    const last = view.index >= fiQuestions.length - 1;
    screen = (
      <QuestionStep
        title="FIRST IMPRESSION"
        questions={fiQuestions}
        answers={fiAnswers}
        index={view.index}
        progress={`Question ${view.index + 1} of ${fiQuestions.length} · ${review.game.title}`}
        onAnswer={(answer) => setFiAnswers((list) => withAnswer(list, answer))}
        onBack={
          view.index > 0 ? () => go({ step: 'first_impression', index: view.index - 1 }) : undefined
        }
        onNext={() => questionNext('first_impression')}
        nextLabel={last ? (editing ? 'Back to summary' : 'Let’s Play!') : 'Next'}
        emptyText="The developer didn’t add any first-impression questions."
        busy={busy}
        error={error}
      />
    );
  } else if (view.step === 'playtest') {
    screen = (
      <PlaytestStep
        review={review}
        playing={playing}
        onStartPlaying={() => setPlaying(true)}
        onAccept={(missionId) =>
          run(() =>
            api.post(`/reviews/${id}/missions/${missionId}/accept`).then(updateStage('playtest')),
          )
        }
        onAddCard={({ type, comment }) =>
          run(async () => {
            const card = await api.post(`/reviews/${id}/cards`, {
              type,
              comment,
              missionId: review.playtest.acceptedMissionIds.at(-1),
              playedSeconds: played,
            });
            setReview((r) => ({
              ...r,
              playtest: { ...r.playtest, cards: [...r.playtest.cards, card] },
            }));
          })
        }
        onUploadProof={(file) =>
          run(async () => {
            const ticket = await api.post('/uploads', {
              purpose: 'proof_screenshot',
              fileName: file.name,
              contentType: file.type,
              size: file.size,
              reviewId: id,
            });
            const upload = await fetch(ticket.url, {
              method: 'PUT',
              headers: ticket.headers,
              body: file,
            });
            if (!upload.ok) throw new Error('The screenshot could not be uploaded. Try again.');
            await api.post(`/uploads/${ticket.id}/complete`, {});
            await savePlaytime({ proofUploadId: ticket.id });
          })
        }
        onContinue={() =>
          run(() => savePlaytime({ complete: true })).then((saved) => {
            if (!saved) return;
            if (devQuestions.length) go({ step: 'developer_questions', index: 0 });
            else finishSection(verdictStart());
          })
        }
        busy={busy}
        error={error}
      />
    );
  } else if (view.step === 'developer_questions') {
    screen = (
      <QuestionStep
        title="DEVELOPER’S QUESTIONS"
        questions={devQuestions}
        answers={devAnswers}
        index={view.index}
        progress={`Question ${view.index + 1} of ${devQuestions.length} · from ${ownerName(review)}, who made ${review.game.title}`}
        onAnswer={(answer) => setDevAnswers((list) => withAnswer(list, answer))}
        onBack={() =>
          view.index > 0
            ? go({ step: 'developer_questions', index: view.index - 1 })
            : go({ step: 'playtest' })
        }
        onNext={() => questionNext('developer_questions')}
        nextLabel={editing && view.index >= devQuestions.length - 1 ? 'Back to summary' : 'Next'}
        busy={busy}
        error={error}
      />
    );
  } else if (view.step === 'final_verdict') {
    screen = (
      <FinalVerdictStep
        review={review}
        step={view.index}
        verdict={verdict}
        onChange={setVerdict}
        onBack={() => go({ step: 'final_verdict', index: view.index - 1 })}
        onNext={verdictNext}
        busy={busy}
        error={error}
      />
    );
  } else {
    screen = (
      <ReviewSummary
        review={review}
        onEdit={edit}
        onSubmit={() =>
          run(() => api.post(`/reviews/${id}/submit`)).then(
            (submitted) => submitted && navigate(`/reviews/${id}`),
          )
        }
        busy={busy}
        error={error}
      />
    );
  }

  return (
    <div className={styles.flow}>
      <ReviewHeaderActions>
        {timing && <Playtime seconds={played} />}
        {canLeave(view, review) && (
          <Button variant="pink" onClick={() => setLeaving(true)}>
            Leave
          </Button>
        )}
      </ReviewHeaderActions>
      {leaving && (
        <LeaveDialog
          busy={busy}
          onSave={saveAndLeave}
          onDiscard={discard}
          onCancel={() => setLeaving(false)}
        />
      )}
      {screen}
    </div>
  );
}

// The leave confirmation is not designed; it follows the form builder's unsaved-changes prompt.
// "Discard review" deletes the draft (DELETE /reviews/:id, "Leave without saving" in the API).
function LeaveDialog({ busy, onSave, onDiscard, onCancel }) {
  const id = useId();
  const dialog = useRef(null);
  useEffect(() => dialog.current?.focus(), []);
  return (
    <div
      ref={dialog}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      tabIndex={-1}
      className={featureStyles.question}
    >
      <h2 id={`${id}-title`} className={featureStyles.sectionTitle}>
        Leave this review?
      </h2>
      <p id={`${id}-text`}>
        Your answers so far are saved, so you can pick up where you left off. Discarding deletes
        this review.
      </p>
      <div className={featureStyles.row}>
        <Button onClick={onSave} disabled={busy}>
          Save and leave
        </Button>
        <Button variant="pink" onClick={onDiscard} disabled={busy}>
          Discard review
        </Button>
        <Button variant="glass" onClick={onCancel} disabled={busy}>
          Keep reviewing
        </Button>
      </div>
    </div>
  );
}

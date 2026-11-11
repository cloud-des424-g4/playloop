import { useState } from 'react';
import { Link, useBeforeUnload, useBlocker, useParams } from 'react-router';
import {
  Button,
  PrimaryButton,
  Tab,
  TabList,
  Tag,
  Textarea,
  TextField,
} from '../../components/index.js';
import { api } from '../../lib/api.js';
import { PageHeader, RequestState } from '../shared/FeatureUI.jsx';

import { useResource } from '../shared/useResource.js';
import { formPayload, newId, newQuestion, validateForm } from './formModel.js';
import { QuestionEditor, RemoveButton } from './QuestionEditor.jsx';
import styles from '../shared/Features.module.css';

export function FormBuilderPage() {
  const { gameId } = useParams();
  const resource = useResource(`/games/${gameId}/form`);
  const game = useResource(`/games/${gameId}`);
  return (
    <RequestState resource={resource}>
      {resource.data && (
        <FormEditor
          key={gameId}
          initial={resource.data}
          gameTitle={game.data?.title}
          gameId={gameId}
        />
      )}
    </RequestState>
  );
}
function FormEditor({ initial, gameTitle, gameId }) {
  const [form, setForm] = useState(() => formPayload(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(formPayload(initial)));
  const [tab, setTab] = useState('firstImpression');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== saved;
  const blocker = useBlocker(dirty);
  useBeforeUnload((event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  function update(section, patch) {
    setForm((current) => ({ ...current, [section]: { ...current[section], ...patch } }));
    setSuccess('');
  }
  async function save() {
    const invalid = validateForm(form);
    setError(invalid);
    setSuccess('');
    if (invalid) return;
    setSaving(true);
    try {
      const result = await api.patch(`/games/${gameId}/form`, formPayload(form));
      const next = formPayload(result);
      setForm(next);
      setSaved(JSON.stringify(next));
      setSuccess('Your PlayLoop form is saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  const tabs = [
    ['firstImpression', '01 First Impression'],
    ['playtest', '02 Playtest'],
    ['finalVerdict', '03 Final Verdict'],
  ];
  const questions = form[tab]?.questions;
  return (
    <div className={styles.page}>
      <PageHeader title="PLAYLOOP FORM">
        <div className={styles.row}>
          <Tag>Game: {gameTitle || 'Your game'}</Tag>
          <Link to="/my-games">My Games</Link>
          {dirty && <span className={styles.caption}>Unsaved changes</span>}
        </div>
      </PageHeader>
      {blocker.state === 'blocked' && (
        <div role="alertdialog" aria-label="Unsaved form" className={styles.question}>
          <p>You have unsaved changes. Leave without saving?</p>
          <div className={styles.row}>
            <Button onClick={() => blocker.reset()}>Keep editing</Button>
            <Button variant="glass" onClick={() => blocker.proceed()}>
              Discard and leave
            </Button>
          </div>
        </div>
      )}
      <TabList label="Form stages" className={styles.tabs}>
        {tabs.map(([key, title]) => (
          <Tab
            key={key}
            id={`tab-${key}`}
            aria-controls={`panel-${key}`}
            selected={tab === key}
            onClick={() => setTab(key)}
          >
            {title}
          </Tab>
        ))}
      </TabList>
      <fieldset
        disabled={saving}
        className={styles.formPanel}
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
      >
        <p>
          {tab === 'firstImpression'
            ? 'Reviewers answer these after they look at your game page, before they play.'
            : tab === 'playtest'
              ? 'Reviewers see these while they play. Missions also tell them roughly how long the playtest takes.'
              : 'Thank your reviewers after their playtest. PlayLoop’s standard Final Verdict questions compare their expectations with their experience.'}
        </p>
        {tab === 'playtest' && (
          <>
            <h2 className={styles.sectionTitle}>Missions</h2>
            <p className={styles.caption}>
              Reviewers react to each mission with Enjoyed It, Confused or Found a Bug.
            </p>
            {form.playtest.missions.map((mission, i) => (
              <div key={mission.id} className={styles.editorRow}>
                <TextField
                  label={`Mission ${i + 1}`}
                  maxLength={160}
                  value={mission.title}
                  onChange={(e) =>
                    update('playtest', {
                      missions: form.playtest.missions.map((m) =>
                        m.id === mission.id ? { ...m, title: e.target.value } : m,
                      ),
                    })
                  }
                />
                <TextField
                  label="Time (min)"
                  type="number"
                  min={1}
                  max={600}
                  value={mission.minutes}
                  onChange={(e) =>
                    update('playtest', {
                      missions: form.playtest.missions.map((m) =>
                        m.id === mission.id ? { ...m, minutes: Number(e.target.value) } : m,
                      ),
                    })
                  }
                />
                <RemoveButton
                  label={`Remove mission ${i + 1}`}
                  onClick={() =>
                    update('playtest', {
                      missions: form.playtest.missions.filter((m) => m.id !== mission.id),
                    })
                  }
                />
              </div>
            ))}
            <div className={styles.between}>
              <Button
                variant="glass"
                disabled={form.playtest.missions.length >= 10}
                onClick={() =>
                  update('playtest', {
                    missions: [...form.playtest.missions, { id: newId(), title: '', minutes: 5 }],
                  })
                }
              >
                + Add a mission
              </Button>
              <span className={styles.caption}>
                About {form.playtest.missions.reduce((sum, m) => sum + Number(m.minutes), 0)} min in
                total
              </span>
            </div>
            <h2 className={styles.sectionTitle}>Known Issues</h2>
            <p className={styles.caption}>Reviewers won’t report these as new bugs.</p>
            {form.playtest.knownIssues.map((issue, i) => (
              <div className={styles.issueRow} key={i}>
                <TextField
                  label={`Known issue ${i + 1}`}
                  value={issue}
                  maxLength={200}
                  onChange={(e) =>
                    update('playtest', {
                      knownIssues: form.playtest.knownIssues.map((s, j) =>
                        j === i ? e.target.value : s,
                      ),
                    })
                  }
                />
                <RemoveButton
                  label={`Remove issue ${i + 1}`}
                  onClick={() =>
                    update('playtest', {
                      knownIssues: form.playtest.knownIssues.filter((_, j) => j !== i),
                    })
                  }
                />
              </div>
            ))}
            <Button
              variant="glass"
              disabled={form.playtest.knownIssues.length >= 20}
              onClick={() =>
                update('playtest', { knownIssues: [...form.playtest.knownIssues, ''] })
              }
            >
              + Add an issue
            </Button>
            <h2 className={styles.sectionTitle}>Developer’s Questions</h2>
            <p className={styles.caption}>Reviewers answer these after the missions.</p>
          </>
        )}
        {questions?.map((q, i) => (
          <QuestionEditor
            key={q.id}
            question={q}
            index={i}
            onChange={(next) =>
              update(tab, { questions: questions.map((item) => (item.id === q.id ? next : item)) })
            }
            onRemove={() =>
              update(tab, { questions: questions.filter((item) => item.id !== q.id) })
            }
          />
        ))}
        {questions && (
          <div className={styles.center}>
            <Button
              variant="glass"
              disabled={questions.length >= 20}
              onClick={() => update(tab, { questions: [...questions, newQuestion()] })}
            >
              + Add a question
            </Button>
          </div>
        )}
        {tab === 'finalVerdict' && (
          <Textarea
            label="Farewell message"
            hint={`${form.finalVerdict.farewellMessage?.length || 0}/500 characters`}
            rows={5}
            maxLength={500}
            value={form.finalVerdict.farewellMessage || ''}
            placeholder="Thanks for playing! Your feedback helps shape our next build."
            onChange={(e) => update('finalVerdict', { farewellMessage: e.target.value })}
          />
        )}
      </fieldset>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}
      <div className={styles.center}>
        <PrimaryButton size="md" disabled={saving || !dirty} onClick={save}>
          {saving ? 'Saving…' : 'Save form'}
        </PrimaryButton>
      </div>
    </div>
  );
}

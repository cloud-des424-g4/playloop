const choice = (id, title, labels) => ({
  id,
  type: 'multiple_choice',
  title,
  required: true,
  preset: id,
  options: Object.entries(labels).map(([optionId, label]) => ({ id: optionId, label })),
});

export const DIFFICULTY_LABELS = {
  easy: 'Easy',
  moderate: 'Moderate',
  challenging: 'Challenging',
  very_hard: 'Very Hard',
};

export const STRENGTH_LABELS = {
  visuals: 'Visuals',
  gameplay: 'Gameplay',
  story: 'Story',
  audio: 'Audio',
  originality: 'Originality',
};

export const AUDIENCE_LABELS = {
  casual: 'Casual players',
  experienced: 'Experienced players',
  everyone: 'Everyone',
  not_sure: 'Not sure',
};

export function defaultForm() {
  return {
    revision: 1,
    firstImpression: {
      questions: [
        {
          id: 'impression',
          type: 'paragraph',
          title: 'What is your first impression of this game?',
          description:
            'Based on the screenshots and description, what do you think this game will be like? What looks interesting, and what looks unclear?',
          required: true,
          preset: 'impression',
        },
        choice('difficulty', 'How difficult do you expect this game to be?', DIFFICULTY_LABELS),
        choice('strength', 'What do you expect to be the strongest part?', STRENGTH_LABELS),
        choice('audience', 'Who do you think this game is made for?', AUDIENCE_LABELS),
        {
          id: 'excitement',
          type: 'slider',
          title: 'How excited are you to play this game?',
          required: true,
          preset: 'excitement',
          slider: {
            min: 1,
            max: 5,
            step: 1,
            minLabel: 'Not at all',
            maxLabel: "Can't wait",
            valueLabels: ['Not excited', 'A little', 'Curious', 'Very excited', "Can't wait"],
          },
        },
      ],
    },
    playtest: { missions: [], knownIssues: [], questions: [] },
    finalVerdict: { farewellMessage: null },
    updatedAt: new Date(),
  };
}

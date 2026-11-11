import { useState } from 'react';
import { Link } from 'react-router';
import {
  AchievementBadge,
  AdminMetric,
  Avatar,
  BadgeList,
  BrandMark,
  Button,
  Checkbox,
  CheckboxField,
  ChoiceChip,
  GameCard,
  GameCardGlass,
  GlassPanel,
  IconButton,
  InitialAvatar,
  Keycap,
  Metric,
  MissionCard,
  NoticePanel,
  Playtime,
  PrimaryButton,
  ProfileHeader,
  ReactionEntry,
  ReactionTag,
  Recommendation,
  ReportRow,
  ReviewCard,
  ReviewProgress,
  SearchInput,
  Select,
  StatusBadge,
  Tab,
  TabList,
  Tag,
  TextField,
  Textarea,
  TextLink,
  Thumbnail,
} from '../components/index.js';
import { toneForGenre } from '../lib/tagTones.js';
import { cx } from '../lib/cx.js';
import breachProtocolCover from './samples/breach-protocol-cover.webp';
import enolaPortrait from './samples/enola-portrait.webp';
import nitroPhantomCover from './samples/nitro-phantom-cover.webp';
import starMayhemCover from './samples/star-mayhem-cover.webp';
import tideboundCover from './samples/tidebound-cover.webp';
import styles from './ComponentGallery.module.css';

const FIGMA_FILE = 'https://www.figma.com/design/m8i4PGK6yx0PwGw3aVkSUG/PlayLoop';

const COLOR_TOKENS = [
  'accent-blue',
  'accent-orange',
  'text-primary',
  'tint-blue',
  'tint-sky',
  'tint-lilac',
  'tint-lime',
  'tint-sunny',
  'tint-orange',
  'surface-card',
  'surface-chip',
  'surface-key',
];

const TYPE_STYLES = [
  ['display', 'Display'],
  ['heading-1', 'Heading 1'],
  ['heading-2', 'Heading 2'],
  ['heading-3', 'Heading 3'],
  ['card-title', 'Card title'],
  ['body', 'Body'],
  ['body-small', 'Body small'],
  ['caption', 'Caption'],
  ['nav', 'Nav'],
  ['button', 'Button'],
  ['tag', 'Tag'],
  ['key', 'Key'],
];

const GENRES = ['RPG', 'Adventure', 'Fantasy', 'Survival', 'Racing', 'Shooter', 'Horror'];

const BADGES = [
  { title: 'First Launch', detail: 'Published your first game', icon: 'launch' },
  { title: 'Thoughtful Critic', detail: '12 reviews and counting', icon: 'review' },
  { title: 'Helping Hand', detail: '84 helpful votes', icon: 'heart' },
];

const QUESTION_TYPES = [
  { value: 'short_answer', label: 'Short answer' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'multiple_choice', label: 'Multiple choice' },
];

function Section({ number, title, children }) {
  return (
    <GlassPanel as="section" variant="panel" className={styles.section}>
      <h2 className={styles.sectionTitle}>
        {number} / {title}
      </h2>
      <div className={styles.specimens}>{children}</div>
    </GlassPanel>
  );
}

function Specimen({ name, figmaNode, dark, wide, children }) {
  return (
    <figure className={cx(styles.specimen, wide && styles.wide)}>
      <div className={cx(styles.preview, dark && styles.dark)}>{children}</div>
      <figcaption className={styles.caption}>
        {name}
        {figmaNode && (
          <>
            {' · '}
            <a
              href={`${FIGMA_FILE}?node-id=${figmaNode.replace(':', '-')}`}
              target="_blank"
              rel="noreferrer"
            >
              Figma {figmaNode} ↗
            </a>
          </>
        )}
      </figcaption>
    </figure>
  );
}

export function ComponentGallery() {
  const [platformChecked, setPlatformChecked] = useState(true);
  const [chipSelected, setChipSelected] = useState(false);
  const [tab, setTab] = useState('published');
  const [missionState, setMissionState] = useState('available');

  return (
    <div className={styles.gallery}>
      <header className={styles.intro}>
        <h1 className={styles.title}>Base components</h1>
        <p className={styles.lead}>
          Every component exported from the Figma handoff board, rendered with sample content. This
          route only exists in development.
        </p>
      </header>

      <Section number="01" title="Foundations">
        <Specimen name="Colour tokens" wide>
          <ul className={styles.swatches}>
            {COLOR_TOKENS.map((token) => (
              <li key={token} className={styles.swatch}>
                <span style={{ background: `var(--playloop-${token})` }} />
                <code>--playloop-{token}</code>
              </li>
            ))}
          </ul>
        </Specimen>
        <Specimen name="Type styles" wide>
          <ul className={styles.typeScale}>
            {TYPE_STYLES.map(([token, label]) => (
              <li key={token} style={{ font: `var(--playloop-type-${token})` }}>
                {label} / Aa 0123
              </li>
            ))}
          </ul>
        </Specimen>
      </Section>

      <Section number="02" title="Actions">
        <Specimen name="PrimaryButton" figmaNode="196:134">
          <PrimaryButton>Try our Game!</PrimaryButton>
          <PrimaryButton size="md">Save Changes</PrimaryButton>
        </Specimen>
        <Specimen name="Button" figmaNode="196:120">
          <Button>Log In</Button>
          <Button variant="glass">Cancel</Button>
        </Specimen>
        <Specimen name="TextLink / IconButton" figmaNode="426:1519">
          <TextLink as={Link} to="/login">
            Log in
          </TextLink>
          <IconButton label="Remove website" />
        </Specimen>
      </Section>

      <Section number="03" title="Forms & selection">
        <Specimen name="TextField" figmaNode="220:373">
          <TextField label="Display name" defaultValue="Enola" className={styles.field} />
        </Specimen>
        <Specimen name="Textarea" figmaNode="225:478">
          <Textarea
            label="Bio"
            defaultValue="Indie dev making stormy games."
            className={styles.field}
          />
        </Specimen>
        <Specimen name="SearchInput" figmaNode="196:135" dark>
          <SearchInput onSearch={() => {}} />
        </Specimen>
        <Specimen name="Select" figmaNode="426:1506">
          <Select
            aria-label="Answer type"
            placeholder="Fill in the blank"
            options={QUESTION_TYPES}
          />
        </Specimen>
        <Specimen name="Checkbox / CheckboxField" figmaNode="426:1499">
          <Checkbox aria-label="Unchecked example" />
          <Checkbox aria-label="Checked example" defaultChecked />
          <CheckboxField
            label="PC"
            checked={platformChecked}
            onChange={(event) => setPlatformChecked(event.target.checked)}
          />
        </Specimen>
        <Specimen name="ChoiceChip (legacy)" figmaNode="356:1727">
          <ChoiceChip>Label</ChoiceChip>
          <ChoiceChip selected={chipSelected} onClick={() => setChipSelected(!chipSelected)}>
            Toggle me
          </ChoiceChip>
        </Specimen>
      </Section>

      <Section number="04" title="Tags, tabs & keycaps">
        <Specimen name="Tag tones" figmaNode="196:123">
          {GENRES.map((genre) => (
            <Tag key={genre} tone={toneForGenre(genre)}>
              {genre}
            </Tag>
          ))}
          <Tag>Unity</Tag>
        </Specimen>
        <Specimen name="TabList / Tab / StatusBadge" figmaNode="196:131" dark>
          <TabList label="Profile sections">
            <Tab selected={tab === 'published'} onClick={() => setTab('published')}>
              Published Games
            </Tab>
            <Tab selected={tab === 'reviews'} onClick={() => setTab('reviews')}>
              Reviews
            </Tab>
          </TabList>
          <StatusBadge status="pending">Pending</StatusBadge>
          <StatusBadge status="resolved">Resolve</StatusBadge>
        </Specimen>
        <Specimen name="Keycap / ReactionTag" figmaNode="196:126">
          <Keycap>WASD</Keycap>
          <ReactionTag kind="confused" />
          <ReactionTag kind="enjoyed" />
          <ReactionTag kind="bug" />
        </Specimen>
      </Section>

      <Section number="05" title="Identity & small assets">
        <Specimen name="Avatar / InitialAvatar" figmaNode="218:313">
          <Avatar src={enolaPortrait} name="Enola" />
          <InitialAvatar name="Admin" />
        </Specimen>
        <Specimen name="AchievementBadge" figmaNode="220:300">
          <AchievementBadge {...BADGES[0]} />
        </Specimen>
        <Specimen name="Metric / Thumbnail / BrandMark" figmaNode="220:287">
          <Metric value="12" label="Reviews written" />
          <Thumbnail src={starMayhemCover} alt="Star Mayhem" />
          <BrandMark />
        </Specimen>
      </Section>

      <Section number="06" title="Cards & content">
        <Specimen name="GameCard" figmaNode="178:230">
          <GameCard
            title="Nitro Phantom"
            description="Drift along neon coastal highways and outrun rival crews in a customized supercar."
            coverSrc={nitroPhantomCover}
            tags={[
              { label: 'Racing', tone: toneForGenre('racing') },
              { label: 'Unity' },
              { label: 'Web' },
            ]}
          />
        </Specimen>
        <Specimen name="GameCardGlass" figmaNode="70:54">
          <GameCardGlass
            title="STAR MAYHEM"
            description="Star Mayhem is a fast-paced space shooter where you command a heavy assault cruiser through glittering star fields and enemy armadas."
            coverSrc={starMayhemCover}
            genres={['2D', 'Space Shooter', 'Arcade']}
            platform="WebGL"
            moreLink={<a href="#more">more</a>}
          />
        </Specimen>
        <Specimen name="Recommendation / NoticePanel" figmaNode="426:1598">
          <Recommendation
            as={Link}
            to="/games/breach-protocol"
            title="Breach Protocol"
            metadata="Shooter - Unreal"
            coverSrc={breachProtocolCover}
          />
          <NoticePanel
            title="Known issues"
            messages={[
              'Rain clips through the shelter roof.',
              'No sound in the second facility yet.',
            ]}
            footer="No need to report these."
          />
        </Specimen>
        <Specimen name="ReviewCard" figmaNode="220:377" wide>
          <ReviewCard
            title="Tidebound"
            date="10 Oct 2026"
            summary="The island routes make exploration feel rewarding. I loved finding a new shortcut after each dive. A clearer underwater map would make the next build even better."
            helpful="18 found this helpful"
            coverSrc={tideboundCover}
            action={
              <TextLink as={Link} to="/games/tidebound">
                View game ↗
              </TextLink>
            }
          />
        </Specimen>
      </Section>

      <Section number="07" title="Review feedback & progress">
        <Specimen name="MissionCard" figmaNode="426:1558">
          <MissionCard
            title="Mission 3"
            duration="~15 min"
            description="Survive the Great Storm"
            state={missionState}
            onAccept={() => setMissionState('accepted')}
          />
          <MissionCard
            title="Mission 4"
            duration="~10 min"
            description="Find the radio tower"
            state="accepted"
          />
        </Specimen>
        <Specimen name="ReactionEntry" figmaNode="426:1579">
          <ReactionEntry
            kind="enjoyed"
            timestamp="08:12"
            comment="Found the radio fast. The lightning flash is great."
          />
          <ReactionEntry
            kind="confused"
            timestamp="17:40"
            comment="I walked past the door twice. It blends into the rocks."
          />
        </Specimen>
        <Specimen name="Playtime / ReviewProgress" figmaNode="426:1526" dark>
          <Playtime seconds={21 * 60 + 30} />
          <ReviewProgress currentStep={2} totalSteps={4} />
        </Specimen>
      </Section>

      <Section number="08" title="Reusable compositions">
        <Specimen name="ProfileHeader" figmaNode="220:336" dark wide>
          <ProfileHeader
            displayName="Enola"
            pronouns="she/her"
            username="enolaholmes"
            avatarUrl={enolaPortrait}
            level={4}
            levelTitle="Critic"
            points={1240}
            nextLevelPoints={1500}
            bio="Indie dev making stormy games."
            stats={[
              { value: '12', label: 'Reviews written' },
              { value: '3', label: 'Games published' },
              { value: '84', label: 'Helpful votes' },
            ]}
            tags={[
              { label: 'Survival', tone: 'lime' },
              { label: 'Exploration', tone: 'sky' },
              { label: 'Mystery', tone: 'lilac' },
              { label: 'PC' },
            ]}
            website={{ href: 'https://example.com', label: 'enola.games' }}
            action={
              <Button as={Link} to="/settings/profile" variant="glass">
                Edit Profile
              </Button>
            }
          />
        </Specimen>
        <Specimen name="BadgeList" figmaNode="220:307" wide>
          <BadgeList badges={BADGES} />
        </Specimen>
      </Section>

      <Section number="09" title="Admin patterns">
        <Specimen name="AdminMetric" figmaNode="426:1628">
          <AdminMetric label="Total Users" value="1,248" trend="+12.8%" />
        </Specimen>
        <Specimen name="ReportRow" figmaNode="426:1636" wide>
          <ReportRow
            selected
            title="RPT-001 Review"
            metadata="Reason: Spam - Author: OceanPLayer"
            status={<StatusBadge status="pending">Pending</StatusBadge>}
          />
          <ReportRow
            title="RPT-003 Game Post"
            metadata="Reason: Inappropriate content - Author: PixelDev"
            status={<StatusBadge status="resolved">Resolve</StatusBadge>}
          />
        </Specimen>
      </Section>
    </div>
  );
}

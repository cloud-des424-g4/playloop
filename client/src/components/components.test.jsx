import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Link } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import {
  Avatar,
  Button,
  CheckboxField,
  IconButton,
  MissionCard,
  ReviewProgress,
  SearchInput,
  Select,
  Tab,
  TabList,
  TextField,
} from './index.js';

describe('Button', () => {
  it('renders a native button by default', () => {
    render(<Button>Log In</Button>);
    expect(screen.getByRole('button', { name: 'Log In' })).toHaveAttribute('type', 'button');
  });

  it('renders a router link with as={Link}', () => {
    render(
      <MemoryRouter>
        <Button as={Link} to="/login">
          Log In
        </Button>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Log In' })).toHaveAttribute('href', '/login');
  });
});

describe('IconButton', () => {
  it('uses the label as its accessible name', () => {
    render(<IconButton label="Remove website" />);
    expect(screen.getByRole('button', { name: 'Remove website' })).toBeInTheDocument();
  });
});

describe('TextField', () => {
  it('links the label and error message to the input', () => {
    render(<TextField label="Display name" error="Required" />);
    const input = screen.getByLabelText('Display name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
  });
});

describe('SearchInput', () => {
  it('submits the trimmed query', async () => {
    const onSearch = vi.fn();
    render(<SearchInput onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search games' }), ' storm {enter}');
    expect(onSearch).toHaveBeenCalledWith('storm');
  });
});

describe('Select', () => {
  it('starts on the placeholder', () => {
    render(
      <Select
        aria-label="Answer type"
        placeholder="Fill in the blank"
        options={[{ value: 'paragraph', label: 'Paragraph' }]}
      />,
    );
    expect(screen.getByRole('combobox', { name: 'Answer type' })).toHaveValue('');
  });
});

describe('CheckboxField', () => {
  it('toggles when its label is clicked', async () => {
    render(<CheckboxField label="PC" />);
    await userEvent.click(screen.getByText('PC'));
    expect(screen.getByRole('checkbox', { name: 'PC' })).toBeChecked();
  });
});

describe('TabList', () => {
  it('moves focus with the arrow keys', async () => {
    render(
      <TabList label="Profile sections">
        <Tab selected>Published Games</Tab>
        <Tab>Reviews</Tab>
      </TabList>,
    );
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Published Games' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveFocus();
  });
});

describe('Avatar', () => {
  it('falls back to the initial when there is no picture', () => {
    render(<Avatar name="enola" />);
    expect(screen.getByRole('img', { name: 'enola' })).toHaveTextContent('E');
  });
});

describe('MissionCard', () => {
  it('is a button only while available and acceptable', async () => {
    const onAccept = vi.fn();
    const { rerender } = render(
      <MissionCard title="Mission 3" state="available" onAccept={onAccept} />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Mission 3/ }));
    expect(onAccept).toHaveBeenCalledOnce();

    rerender(<MissionCard title="Mission 3" state="accepted" onAccept={onAccept} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Accepted')).toBeInTheDocument();
  });
});

describe('ReviewProgress', () => {
  it('derives the pips and label from the step values', () => {
    render(<ReviewProgress currentStep={2} totalSteps={4} />);
    const progress = screen.getByRole('progressbar');
    expect(progress).toHaveAttribute('aria-valuenow', '2');
    expect(progress).toHaveTextContent('Final verdict · 2 of 4');
  });
});

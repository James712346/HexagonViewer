import * as React from 'react';
import clsx from 'clsx';
import {
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';

interface ProgressBarProps {
  value: number;
  outof: number;
  completedSteps: number;
}

const Center = styled('div')({
  height: '100%',
  display: 'flex',
  alignItems: 'center',
});

const Element = styled('div')(({ theme }) => ({
  border: `1px solid ${(theme.vars || theme).palette.divider}`,
  position: 'relative',
  overflow: 'hidden',
  width: '100%',
  height: 26,
  borderRadius: 2,
}));

const Value = styled('div')({
  position: 'absolute',
  lineHeight: '24px',
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
});

const Bar = styled('div')({
  height: '100%',
  '&.low': {
    backgroundColor: '#f44336',
  },
  '&.medium': {
    backgroundColor: '#efbb5aa3',
  },
  '&.high': {
    backgroundColor: '#088208a3',
  },
});

const ProgressBar = React.memo(function ProgressBar(props: ProgressBarProps) {
  const { value, outof, completedSteps } = props;
  const valueInPercent = value;

  return (
    <Element>
      <Value>{`${completedSteps} / ${outof}`}</Value>
      <Bar
        className={clsx({
          low: valueInPercent < 30,
          medium: valueInPercent >= 30 && valueInPercent <= 70,
          high: valueInPercent > 70,
        })}
        style={{ maxWidth: `${valueInPercent}%` }}
      />
    </Element>
  );
});


export function renderProgress(params: GridRenderCellParams<any, number, any>) {
  if (params.value == null) {
    return '';
  }
  console.log(params);
  return (
    <Center>
      <ProgressBar value={params.value} outof={params.row.total_count} completedSteps = {params.row.completed_count} />
    </Center>
  );
}


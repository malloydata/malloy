import React, {useState} from 'react';
import {useChannel} from '@storybook/manager-api';
import {AddonPanel} from '@storybook/components';

export const ADDON_ID = 'malloy/renderer-logs';
export const PANEL_ID = `${ADDON_ID}/panel`;
export const EVENT_ID = `${ADDON_ID}/logs`;

interface LogMessage {
  severity: string;
  message: string;
}

const h = React.createElement;

function LogsContent() {
  const [logs, setLogs] = useState<LogMessage[]>([]);

  useChannel({
    [EVENT_ID]: (newLogs: LogMessage[]) => {
      setLogs(newLogs);
    },
  });

  if (logs.length === 0) {
    return h(
      'div',
      {
        style: {
          padding: '12px',
          color: '#888',
          fontFamily: 'monospace',
          fontSize: '12px',
        },
      },
      'No renderer logs.'
    );
  }

  return h(
    'div',
    {style: {padding: '8px', fontFamily: 'monospace', fontSize: '12px'}},
    logs.map((log, i) =>
      h(
        'div',
        {
          key: i,
          style: {
            padding: '4px 8px',
            color: log.severity === 'error' ? '#c62828' : '#f57f17',
            borderBottom: '1px solid #eee',
          },
        },
        h(
          'span',
          {style: {marginRight: '6px'}},
          log.severity === 'error' ? '\u274c' : '\u26a0\ufe0f'
        ),
        log.message
      )
    )
  );
}

export function RendererLogsPanel(props: {active?: boolean}) {
  return h(AddonPanel, {active: props.active ?? false}, h(LogsContent));
}

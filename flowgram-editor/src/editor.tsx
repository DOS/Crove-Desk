/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, useState } from 'react';

import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';
import type { FlowDocumentJSON } from './typings';

const MESSAGE_SOURCE = 'agent-desk';

type LoadMessage = {
  source: typeof MESSAGE_SOURCE;
  type: 'workflow:load';
  documentKey: string;
  document: FlowDocumentJSON;
  readonly?: boolean;
};

export const Editor = () => {
  const [documentKey, setDocumentKey] = useState('official-default');
  const [document, setDocument] = useState<FlowDocumentJSON>(initialData);
  const [readonly, setReadonly] = useState(false);
  const handleDocumentChange = useCallback((nextDocument: FlowDocumentJSON) => {
    window.parent.postMessage(
      {
        source: MESSAGE_SOURCE,
        type: 'workflow:change',
        document: nextDocument,
      },
      window.location.origin
    );
  }, []);
  const editorProps = useEditorProps(document, nodeRegistries, handleDocumentChange, readonly);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<LoadMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.source !== MESSAGE_SOURCE ||
        event.data?.type !== 'workflow:load'
      ) {
        return;
      }
      setDocumentKey(event.data.documentKey);
      setDocument(event.data.document);
      setReadonly(Boolean(event.data.readonly));
    };
    window.addEventListener('message', handleMessage);
    window.parent.postMessage(
      { source: MESSAGE_SOURCE, type: 'workflow:ready' },
      window.location.origin
    );
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider key={`${documentKey}-${readonly}`} {...editorProps}>
        <div className="demo-container">
          <DockedPanelLayer>
            <EditorRenderer className="demo-editor" />
          </DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};

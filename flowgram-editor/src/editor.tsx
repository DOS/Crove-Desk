/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useCallback, useEffect, useState } from 'react';

import { DockedPanelLayer } from '@flowgram.ai/panel-manager-plugin';
import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import type { FlowDocumentJSON } from './typings';
import {
  createBusinessNodeRegistries,
  enrichDocumentWithNodeSpecs,
  nodeRegistries,
  setActiveNodeRegistries,
  type WorkflowNodeSpec,
} from './nodes';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';

const MESSAGE_SOURCE = 'agent-desk';

type LoadMessage = {
  source: typeof MESSAGE_SOURCE;
  type: 'workflow:load';
  documentKey: string;
  document: FlowDocumentJSON;
  nodeSpecs?: WorkflowNodeSpec[];
  readonly?: boolean;
};

export const Editor = () => {
  const [documentKey, setDocumentKey] = useState('official-default');
  const [documentRevision, setDocumentRevision] = useState(0);
  const [document, setDocument] = useState<FlowDocumentJSON>(initialData);
  const [readonly, setReadonly] = useState(false);
  const [registries, setRegistries] = useState(nodeRegistries);
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
  const editorProps = useEditorProps(document, registries, handleDocumentChange, readonly);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<LoadMessage>) => {
      if (
        event.origin !== window.location.origin ||
        event.data?.source !== MESSAGE_SOURCE ||
        event.data?.type !== 'workflow:load'
      ) {
        return;
      }
      const nodeSpecs = event.data.nodeSpecs ?? [];
      const executableTypes = new Set(
        nodeSpecs.filter((spec) => spec.executable).map((spec) => spec.type)
      );
      const builtInRegistries =
        executableTypes.size > 0
          ? nodeRegistries.filter((registry) => executableTypes.has(registry.type as string))
          : nodeRegistries;
      const businessRegistries = createBusinessNodeRegistries(nodeSpecs);
      const nextRegistries = [...builtInRegistries, ...businessRegistries];
      setDocumentKey(event.data.documentKey);
      setDocumentRevision((revision) => revision + 1);
      setActiveNodeRegistries(nextRegistries);
      setRegistries(nextRegistries);
      setDocument(enrichDocumentWithNodeSpecs(event.data.document, nodeSpecs));
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
      <FreeLayoutEditorProvider
        key={`${documentKey}-${documentRevision}-${readonly}`}
        {...editorProps}
      >
        <div className="demo-container">
          <DockedPanelLayer>
            <EditorRenderer className="demo-editor" />
          </DockedPanelLayer>
        </div>
      </FreeLayoutEditorProvider>
    </div>
  );
};

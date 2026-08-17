/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

/* eslint-disable no-console */
import {
  FlowGramAPIName,
  IRuntimeClient,
  type TaskReportOutput,
} from '@flowgram.ai/runtime-interface';
import { injectable } from '@flowgram.ai/free-layout-editor';

import { buildBusinessDebugReport, isBusinessDebugSchema } from './business-debug-runtime';

@injectable()
export class WorkflowRuntimeBrowserClient implements IRuntimeClient {
  private businessDebugTasks = new Map<string, TaskReportOutput>();

  constructor() {}

  public [FlowGramAPIName.TaskRun]: IRuntimeClient[FlowGramAPIName.TaskRun] = async (input) => {
    if (isBusinessDebugSchema(input)) {
      const taskID = `business-debug-${Date.now()}`;
      this.businessDebugTasks.set(taskID, buildBusinessDebugReport(input, taskID));
      return { taskID };
    }
    const { TaskRunAPI } = await import('@flowgram.ai/runtime-js'); // Load on demand - 按需加载
    return TaskRunAPI(input);
  };

  public [FlowGramAPIName.TaskReport]: IRuntimeClient[FlowGramAPIName.TaskReport] = async (
    input
  ) => {
    if (this.businessDebugTasks.has(input.taskID)) {
      return this.businessDebugTasks.get(input.taskID);
    }
    const { TaskReportAPI } = await import('@flowgram.ai/runtime-js'); // Load on demand - 按需加载
    return TaskReportAPI(input);
  };

  public [FlowGramAPIName.TaskResult]: IRuntimeClient[FlowGramAPIName.TaskResult] = async (
    input
  ) => {
    const report = this.businessDebugTasks.get(input.taskID);
    if (report) {
      return report.outputs;
    }
    const { TaskResultAPI } = await import('@flowgram.ai/runtime-js'); // Load on demand - 按需加载
    return TaskResultAPI(input);
  };

  public [FlowGramAPIName.TaskCancel]: IRuntimeClient[FlowGramAPIName.TaskCancel] = async (
    input
  ) => {
    if (this.businessDebugTasks.delete(input.taskID)) {
      return { success: true };
    }
    const { TaskCancelAPI } = await import('@flowgram.ai/runtime-js'); // Load on demand - 按需加载
    return TaskCancelAPI(input);
  };

  public [FlowGramAPIName.TaskValidate]: IRuntimeClient[FlowGramAPIName.TaskValidate] = async (
    input
  ) => {
    if (isBusinessDebugSchema(input)) {
      return { valid: true, errors: [] };
    }
    const { TaskValidateAPI } = await import('@flowgram.ai/runtime-js'); // Load on demand - 按需加载
    return TaskValidateAPI(input);
  };
}

/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

import { useLayoutEffect } from 'react';

import { nanoid } from 'nanoid';
import { Field, FieldArray, I18n, WorkflowNodePortsData } from '@flowgram.ai/free-layout-editor';
import { ConditionRow, ConditionRowValueType } from '@flowgram.ai/form-materials';
import { Button, Select, Space } from '@douyinfe/semi-ui';
import { IconCrossCircleStroked, IconDelete, IconPlus } from '@douyinfe/semi-icons';

import { useNodeRenderContext, useIsSidebar } from '../../../hooks';
import { Feedback, FormItem } from '../../../form-components';
import { ConditionBranch, ConditionBranchLogic, ConditionPort } from './styles';

interface ConditionValue {
  key: string;
  value?: ConditionRowValueType;
}

interface BranchItem {
  logic: string; // 'and' | 'or'
  conditions: ConditionValue[];
}

export function ConditionInputs() {
  const { node, readonly } = useNodeRenderContext();
  const isSidebar = useIsSidebar();

  useLayoutEffect(() => {
    window.requestAnimationFrame(() => {
      node.getData<WorkflowNodePortsData>(WorkflowNodePortsData).updateDynamicPorts();
    });
  }, [node]);

  return (
    <FieldArray name="branch">
      {({ field: conditions }) => (
        <>
          {conditions.map((branch, index) => (
            <Field<BranchItem> name={branch.name} key={branch.name}>
              {({ field, fieldState }) => (
                <FormItem
                  type="boolean"
                  labelWidth={100}
                  name={index === 0 ? I18n.t('IF') : I18n.t('ELSE-IF')}
                  vertical
                  required={index === 0}
                >
                  <ConditionBranch>
                    {field.value.conditions.length > 1 && (
                      <ConditionBranchLogic>
                        <Select
                          size="small"
                          value={field.value.logic}
                          style={{ backgroundColor: 'var(--semi-color-bg-0)' }}
                          onChange={(v) =>
                            field.onChange({
                              ...field.value,
                              logic: (v as string) ?? 'and',
                            })
                          }
                        >
                          <Select.Option value="and">{I18n.t('AND')}</Select.Option>
                          <Select.Option value="or">{I18n.t('OR')}</Select.Option>
                        </Select>
                      </ConditionBranchLogic>
                    )}
                    <div style={{ flex: 1 }}>
                      {field.value.conditions.map((condition, childIndex) => (
                        <Field<ConditionValue>
                          name={`${field.name}.conditions.${childIndex}`}
                          key={condition.key}
                        >
                          {({ field: conditionField }) => (
                            <Space align="center" style={{ padding: '6px 0', width: '100%' }}>
                              <div style={{ flex: 1 }}>
                                <ConditionRow
                                  readonly={readonly}
                                  value={conditionField.value.value}
                                  onChange={(v) => {
                                    conditionField.onChange({
                                      value: v,
                                      key: conditionField.value.key,
                                    });
                                  }}
                                />
                              </div>
                              {/*remove current branch condition*/}
                              {isSidebar && !readonly && (
                                <Button
                                  theme="borderless"
                                  disabled={field.value?.conditions.length === 1}
                                  icon={<IconCrossCircleStroked />}
                                  onClick={() =>
                                    field.onChange({
                                      ...field.value,
                                      conditions: field.value.conditions.filter(
                                        (i: ConditionValue) => i.key !== condition.key
                                      ),
                                    })
                                  }
                                />
                              )}
                            </Space>
                          )}
                        </Field>
                      ))}
                    </div>

                    <ConditionPort data-port-id={`${branch.name}`} data-port-type="output" />
                  </ConditionBranch>

                  {/* remove current branch and add new condition*/}
                  {isSidebar && !readonly && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button
                        size="small"
                        theme="borderless"
                        icon={<IconPlus />}
                        onClick={() => {
                          field.onChange({
                            ...field.value,
                            conditions: [
                              ...field.value.conditions,
                              {
                                key: `condition_${nanoid(6)}`,
                                value: {},
                              },
                            ],
                          });
                        }}
                      >
                        {I18n.t('Add condition')}
                      </Button>
                      <Button
                        disabled={conditions.value?.length === 1}
                        size="small"
                        theme="borderless"
                        icon={<IconDelete />}
                        onClick={() => conditions.remove(index)}
                      >
                        {I18n.t('Remove branch')}
                      </Button>
                    </div>
                  )}
                  <Feedback errors={fieldState?.errors} invalid={fieldState?.invalid} />
                </FormItem>
              )}
            </Field>
          ))}

          {/*  else */}
          <FormItem name={I18n.t('ELSE')} type="boolean" required={true} labelWidth={100}>
            <ConditionPort data-port-id="else" data-port-type="output" />
          </FormItem>

          {!readonly && (
            <div>
              <Button
                theme="borderless"
                icon={<IconPlus />}
                onClick={() =>
                  conditions.append({
                    logic: 'and',
                    conditions: [
                      {
                        key: `condition_${nanoid(6)}`,
                        value: {},
                      },
                    ],
                  })
                }
              >
                {I18n.t('Add branch')}
              </Button>
            </div>
          )}
        </>
      )}
    </FieldArray>
  );
}

"use client";

import type {
  ExamAccentType,
  ExamAsrModelType,
  ExamSettings,
} from "./settings-types";
import type { Key } from "@heroui/react";

import { ChevronDown, Gear } from "@gravity-ui/icons";
import {
  Button,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
} from "@heroui/react";

import ModalBackdrop from "@/components/common/modal-backdrop";

interface ExamSettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ExamSettings;
  onAccentChange: (v: ExamAccentType) => void;
  onDictationPlayCountChange: (v: number) => void;
  onRetryCountChange: (v: number) => void;
  onAsrModelChange: (v: ExamAsrModelType) => void;
}

export default function ExamSettingsModal({
  isOpen,
  onOpenChange,
  settings,
  onAccentChange,
  onDictationPlayCountChange,
  onRetryCountChange,
  onAsrModelChange,
}: ExamSettingsModalProps) {
  return (
    <ModalBackdrop
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      placement="center"
      size="md"
    >
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
          <Gear className="size-5" />
        </Modal.Icon>
        <Modal.Heading>考试设置</Modal.Heading>
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-5 py-2">
        {/* 听写口音 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              听写口音
            </span>
            <span className="text-xs text-muted">听写模式下的发音口音</span>
          </div>
          <Select
            aria-label="听写口音"
            className="w-[150px]"
            selectedKey={settings.accent}
            onSelectionChange={(k: Key | null) =>
              onAccentChange((k as ExamAccentType) ?? "Speech_US")
            }
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover className="w-[150px]">
              <ListBox>
                <ListBox.Item id="Speech_US" textValue="美式发音">
                  美式发音
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="Speech_EN" textValue="英式发音">
                  英式发音
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* 听写复读次数 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              听写复读次数
            </span>
            <span className="text-xs text-muted">
              每道听写题的朗读次数（1-10次）
            </span>
          </div>
          <NumberField
            aria-label="听写复读次数"
            className="w-[130px]"
            maxValue={10}
            minValue={1}
            value={settings.dictationPlayCount}
            variant="secondary"
            onChange={(v) =>
              onDictationPlayCountChange(Number.isNaN(v) ? 1 : v)
            }
          >
            <NumberField.Group className="flex w-full">
              <NumberField.DecrementButton className="px-[10px]" />
              <NumberField.Input className="w-full text-center" />
              <NumberField.IncrementButton className="px-[10px]" />
            </NumberField.Group>
          </NumberField>
        </div>

        {/* 错误重试次数 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              错误重试次数
            </span>
            <span className="text-xs text-muted">
              答错后可重试的次数（1-10次）
            </span>
          </div>
          <NumberField
            aria-label="错误重试次数"
            className="w-[130px]"
            maxValue={10}
            minValue={1}
            value={settings.retryCount}
            variant="secondary"
            onChange={(v) => onRetryCountChange(Number.isNaN(v) ? 1 : v)}
          >
            <NumberField.Group className="flex w-full">
              <NumberField.DecrementButton className="px-[10px]" />
              <NumberField.Input className="w-full text-center" />
              <NumberField.IncrementButton className="px-[10px]" />
            </NumberField.Group>
          </NumberField>
        </div>

        {/* 语音识别模型 */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              语音识别模型
            </span>
            <span className="text-xs text-muted">语音模式下的识别引擎</span>
          </div>
          <Select
            aria-label="语音识别模型"
            className="w-[150px]"
            selectedKey={settings.asrModelType}
            onSelectionChange={(k: Key | null) =>
              onAsrModelChange((k as ExamAsrModelType) ?? "2")
            }
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator>
                <ChevronDown />
              </Select.Indicator>
            </Select.Trigger>
            <Select.Popover className="w-[150px]">
              <ListBox>
                <ListBox.Item id="2" textValue="讯飞语音">
                  讯飞语音
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="3" textValue="百度语音">
                  百度语音
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="1" textValue="本地模型">
                  本地模型
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                <ListBox.Item id="4" textValue="本地模型2">
                  本地模型2
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </div>

        {/* 说明文字 */}
        <div className="rounded-lg bg-black/[0.02] p-3 text-xs text-muted dark:bg-white/[0.02]">
          <p className="mb-1 font-medium">设置说明：</p>
          <ul className="list-inside list-disc space-y-0.5">
            <li>听写口音：影响听写模式的发音</li>
            <li>听写复读次数：每道听写题的朗读次数</li>
            <li>错误重试次数：四种模式通用，答错后可重试</li>
            <li>语音识别模型：影响语音模式的识别准确率</li>
          </ul>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <Button slot="close" variant="primary">
          完成
        </Button>
      </Modal.Footer>
    </ModalBackdrop>
  );
}

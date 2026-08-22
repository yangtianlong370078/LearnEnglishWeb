"use client";

import type {
  AccentType,
  AsrModelType,
  CourseLearnSettings,
} from "@/types/courselearn";
import type { Key } from "@heroui/react";

import { ChevronDown, Gear } from "@gravity-ui/icons";
import {
  Button,
  Label,
  ListBox,
  Modal,
  NumberField,
  Select,
  Switch,
} from "@heroui/react";

interface SettingsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  settings: CourseLearnSettings;
  onAutoSpeakChange: (v: boolean) => void;
  onHideMeaningChange: (v: boolean) => void;
  onAccentChange: (v: AccentType) => void;
  onDictationCountChange: (v: number) => void;
  onAsrModelChange: (v: AsrModelType) => void;
}

export default function SettingsModal({
  isOpen,
  onOpenChange,
  settings,
  onAutoSpeakChange,
  onHideMeaningChange,
  onAccentChange,
  onDictationCountChange,
  onAsrModelChange,
}: SettingsModalProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="center" size="md">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Gear className="size-5" />
            </Modal.Icon>
            <Modal.Heading>学习设置</Modal.Heading>
          </Modal.Header>

          <Modal.Body className="flex flex-col gap-5 py-2">
            {/* 自动发音 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  自动发音
                </span>
                <span className="text-xs text-muted">单词详情自动播放</span>
              </div>
              <Switch
                aria-label="自动发音"
                isSelected={settings.autoSpeak}
                onChange={onAutoSpeakChange}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {/* 隐藏释义 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  隐藏释义
                </span>
                <span className="text-xs text-muted">单词详情隐藏中文释义</span>
              </div>
              <Switch
                aria-label="隐藏释义"
                isSelected={settings.hideMeaning}
                onChange={onHideMeaningChange}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch>
            </div>

            {/* 首选口音 */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                首选口音
              </span>
              <Select
                aria-label="首选口音"
                className="w-[150px]"
                selectedKey={settings.accent}
                onSelectionChange={(k: Key | null) =>
                  onAccentChange((k as AccentType) ?? "Speech_US")
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

            {/* 听写次数 */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  听写次数
                </span>
                <span className="text-xs text-muted">听写时循环播放次数</span>
              </div>
              <NumberField
                aria-label="听写次数"
                className="w-[130px]"
                maxValue={20}
                minValue={1}
                value={settings.dictationCount}
                variant="secondary"
                onChange={(v) =>
                  onDictationCountChange(Number.isNaN(v) ? 1 : v)
                }
              >
                <NumberField.Group className="flex w-full">
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-full text-center" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
              </NumberField>
            </div>

            {/* 语音识别模型 */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium text-foreground">
                语音识别模型
              </span>
              <Select
                aria-label="语音识别模型"
                className="w-[150px]"
                selectedKey={settings.asrModelType}
                onSelectionChange={(k: Key | null) =>
                  onAsrModelChange((k as AsrModelType) ?? "2")
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
          </Modal.Body>

          <Modal.Footer>
            <Button slot="close" variant="primary">
              完成
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

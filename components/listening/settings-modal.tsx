"use client";

import type {
  ListeningAfterPlay,
  ListeningLanguage,
  ListeningMode,
  ListeningSettings,
} from "@/types/listening";
import type { Key } from "@heroui/react";

import { ChevronDown, Gear } from "@gravity-ui/icons";
import {
  Button,
  ListBox,
  Modal,
  NumberField,
  Select,
  Switch,
} from "@heroui/react";

import ModalBackdrop from "@/components/common/modal-backdrop";

interface ListeningSettingsModalProps {
  isOpen: boolean;
  settings: ListeningSettings;
  onOpenChange: (open: boolean) => void;
  onSettingsChange: (patch: Partial<ListeningSettings>) => void;
}

const MODES: Array<{
  value: ListeningMode;
  label: string;
  description: string;
}> = [
  { value: "continuous", label: "连续", description: "显示全部字幕并连续播放" },
  { value: "single", label: "单句", description: "聚焦当前句，每句结束暂停" },
  {
    value: "dictation",
    label: "听写",
    description: "隐藏字幕，点击句子可重听",
  },
  {
    value: "shadow",
    label: "跟读",
    description: "逐句播放，留出时间复述",
  },
];

export default function ListeningSettingsModal({
  isOpen,
  settings,
  onOpenChange,
  onSettingsChange,
}: ListeningSettingsModalProps) {
  return (
    <ModalBackdrop
      isOpen={isOpen}
      placement="center"
      size="md"
      onOpenChange={onOpenChange}
    >
      <Modal.CloseTrigger />
      <Modal.Header>
        <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
          <Gear className="size-5" />
        </Modal.Icon>
        <Modal.Heading>听力学习设置</Modal.Heading>
        <p className="mt-1.5 text-sm leading-5 text-muted">
          设置会自动保存到当前浏览器
        </p>
      </Modal.Header>

      <Modal.Body className="flex flex-col gap-5 py-2">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
            学习模式
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {MODES.map((mode) => {
              const active = settings.mode === mode.value;

              return (
                <Button
                  key={mode.value}
                  aria-pressed={active}
                  className="h-auto rounded-2xl min-h-[58px] w-full flex-row items-center justify-between whitespace-normal px-4 py-3 text-left"
                  variant={active ? "primary" : "secondary"}
                  onPress={() => onSettingsChange({ mode: mode.value })}
                >
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                    <span className="text-sm font-medium">{mode.label}</span>
                    <span className="text-left text-[11px] font-normal leading-4 opacity-70">
                      {mode.description}
                    </span>
                  </span>
                  <span
                    className={`ml-3 size-2 shrink-0 rounded-full ${
                      active
                        ? "bg-accent-foreground shadow-[0_0_0_4px_rgba(255,255,255,0.18)]"
                        : "bg-foreground/15"
                    }`}
                  />
                </Button>
              );
            })}
          </div>
        </section>

        {settings.mode === "shadow" && (
          <section className="grid grid-cols-1 gap-4 rounded-2xl border-l-2 border-accent/40 pl-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">跟读次数</p>
                <p className="mt-0.5 text-xs text-muted">每句重复播放次数</p>
              </div>
              <NumberField
                aria-label="跟读次数"
                className="w-[120px]"
                maxValue={10}
                minValue={1}
                value={settings.shadowRepeatCount}
                variant="secondary"
                onChange={(value) =>
                  onSettingsChange({
                    shadowRepeatCount: Number.isNaN(value) ? 1 : value,
                  })
                }
              >
                <NumberField.Group className="flex w-full">
                  <NumberField.DecrementButton className="px-[10px]" />
                  <NumberField.Input className="w-full text-center" />
                  <NumberField.IncrementButton className="px-[10px]" />
                </NumberField.Group>
              </NumberField>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">追加间隔</p>
                <p className="mt-0.5 text-xs text-muted">句子时长 + 追加秒数</p>
              </div>
              <NumberField
                aria-label="跟读追加间隔"
                className="w-[120px]"
                maxValue={5}
                minValue={0}
                step={0.5}
                value={settings.shadowGap}
                variant="secondary"
                onChange={(value) =>
                  onSettingsChange({
                    shadowGap: Number.isNaN(value) ? 0 : value,
                  })
                }
              >
                <NumberField.Group className="flex w-full">
                  <NumberField.DecrementButton className="px-[10px]" />
                  <NumberField.Input className="w-full text-center" />
                  <NumberField.IncrementButton className="px-[10px]" />
                </NumberField.Group>
              </NumberField>
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch">
            <span className="text-sm font-medium text-foreground">
              字幕语言
            </span>
            <Select
              aria-label="字幕语言"
              selectedKey={settings.language}
              variant="secondary"
              onSelectionChange={(key: Key | null) =>
                onSettingsChange({
                  language: (key as ListeningLanguage | null) ?? "bi",
                })
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator>
                  <ChevronDown />
                </Select.Indicator>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="en" textValue="仅英文">
                    仅英文
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="bi" textValue="中英双语">
                    中英双语
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="cn" textValue="仅中文">
                    仅中文
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-stretch">
            <span className="text-sm font-medium text-foreground">
              播完行为
            </span>
            <Select
              aria-label="播完行为"
              selectedKey={settings.afterPlay}
              variant="secondary"
              onSelectionChange={(key: Key | null) =>
                onSettingsChange({
                  afterPlay: (key as ListeningAfterPlay | null) ?? "stop",
                })
              }
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator>
                  <ChevronDown />
                </Select.Indicator>
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="stop" textValue="停止播放">
                    停止播放
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="repeat" textValue="本课循环">
                    本课循环
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="next" textValue="自动下一课">
                    自动下一课
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                  <ListBox.Item id="all" textValue="整册循环">
                    整册循环
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl bg-black/[0.025] p-3 dark:bg-white/[0.035]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">跳过片头</p>
              <p className="mt-0.5 text-xs text-muted">从第一句正文开始播放</p>
            </div>
            <Switch
              aria-label="跳过片头"
              isSelected={settings.skipIntro}
              onChange={(value) => onSettingsChange({ skipIntro: value })}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">自动跟随</p>
              <p className="mt-0.5 text-xs text-muted">
                当前句自动滚动到字幕中央
              </p>
            </div>
            <Switch
              aria-label="自动跟随"
              isSelected={settings.autoFollow}
              onChange={(value) => onSettingsChange({ autoFollow: value })}
            >
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
            </Switch>
          </div>
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

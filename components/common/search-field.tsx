"use client";

import {SearchField } from "@heroui/react";

export default function FullWidth() {
  return (
    <div className="w-full space-y-4">
      <SearchField name="primary-search" variant="primary">
        <SearchField.Group
          className="!h-11 !border-0 !bg-[var(--surface)]  backdrop-blur-xl backdrop-saturate-150 !shadow-[inset_0_1px_0_rgb(255_255_255/0.42),0_2px_18px_rgb(0_0_80/0.05),inset_0_0_0_1px_rgb(255_255_255/0.3)] dark:!shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),0_2px_20px_rgb(0_0_0/0.3)]"
        >
          <SearchField.Input className="" placeholder="查询单词…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}

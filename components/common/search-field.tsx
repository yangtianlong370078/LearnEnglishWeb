"use client";

import {SearchField } from "@heroui/react";

export default function FullWidth() {
  return (
    <div className="w-full space-y-4">
      <SearchField fullWidth name="search">
        <SearchField.Group>
          <SearchField.SearchIcon  />
          <SearchField.Input placeholder="查询单词…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>
    </div>
  );
}

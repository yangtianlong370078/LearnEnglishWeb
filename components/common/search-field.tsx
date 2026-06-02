"use client";

import {SearchField } from "@heroui/react";

export default function FullWidth() {
  return (
    <div className="w-full space-y-4">
      <SearchField name="primary-search" variant="primary">
        <SearchField.Group
          className="!h-11 !border-0 !bg-[var(--surface)]  backdrop-blur-xl backdrop-saturate-150 !shadow-[inset_0_1px_0_rgb(255_255_255/0.42),0_2px_18px_rgb(0_0_80/0.05),inset_0_0_0_1px_rgb(255_255_255/0.3)] dark:!shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),0_2px_20px_rgb(0_0_0/0.3)]"
        >
          <SearchField.Input className="ml-2" placeholder="查询单词…" />
         
         
           <SearchField.ClearButton className="mr-0">
                     <svg height="16" viewBox="0 0 16 16" width="16" xmlns="http://www.w3.org/2000/svg">
                       <path
                         clipRule="evenodd"
                         d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M6.53 5.47a.75.75 0 0 0-1.06 1.06L6.94 8L5.47 9.47a.75.75 0 1 0 1.06 1.06L8 9.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.06 8l1.47-1.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                         fill="currentColor"
                         fillRule="evenodd"
                       />
                     </svg>
                   </SearchField.ClearButton>

                   <SearchField.SearchIcon  className="mx-3"/>
        </SearchField.Group>
      </SearchField>
    </div>
  );
}

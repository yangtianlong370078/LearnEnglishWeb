"use client";

import { SearchField, Button, Modal, Spinner, Card } from "@heroui/react";
import React from "react";
import WordDetail from "@/components/common/word-detail";
import { get, post } from "@/lib/api/request";

export default function FullWidth() {
  const [value, setValue] = React.useState("");
  const [searchedWord, setSearchedWord] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [wordExists, setWordExists] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [wordDetailResult, setWordDetailResult] = React.useState<boolean | null>(null);

  const handleSearch = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setSearchedWord(trimmed);
    setIsOpen(true);
    setWordExists(false);
    setIsChecking(true);
    setWordDetailResult(null);
    try {
      const exists = await get<boolean>("/Word/WordExist", { en: trimmed });
      setWordExists(exists);
    } catch {
      setWordExists(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleAddToVocab = async () => {
    const trimmed = searchedWord;
    if (!trimmed) return;

    setIsSaving(true);
    try {
      await post<void>("/Course/SaveCoursecontent", null, {
        params: { courseId: 0, en: trimmed, cn: "" },
      });
      setWordExists(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      <SearchField
        name="primary-search"
        variant="primary"
        value={value}
        onChange={setValue}
        onSubmit={handleSearch}
      >
        <SearchField.Group className="!h-11 !border-0 !bg-[var(--surface)]  backdrop-blur-xl backdrop-saturate-150 !shadow-[inset_0_1px_0_rgb(255_255_255/0.42),0_2px_18px_rgb(0_0_80/0.05),inset_0_0_0_1px_rgb(255_255_255/0.3)] dark:!shadow-[inset_0_0_0_1px_rgb(255_255_255/0.07),0_2px_20px_rgb(0_0_0/0.3)]">
          <SearchField.Input
            className="ml-2 !bg-transparent"
            placeholder="查询单词…"
          />

          <SearchField.ClearButton className="mr-0">
            <svg
              height="16"
              viewBox="0 0 16 16"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                clipRule="evenodd"
                d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14M6.53 5.47a.75.75 0 0 0-1.06 1.06L6.94 8L5.47 9.47a.75.75 0 1 0 1.06 1.06L8 9.06l1.47 1.47a.75.75 0 1 0 1.06-1.06L9.06 8l1.47-1.47a.75.75 0 1 0-1.06-1.06L8 6.94z"
                fill="currentColor"
                fillRule="evenodd"
              />
            </svg>
          </SearchField.ClearButton>
          <Button
            variant="ghost"
            size="sm"
            className="m-0 p-0 hover:bg-transparent data-[hovered=true]:bg-transparent"
            onPress={handleSearch}
          >
            <SearchField.SearchIcon className="mx-3" />
          </Button>
        </SearchField.Group>
      </SearchField>
      <Modal.Backdrop
        className="!bg-transparent"
        isOpen={isOpen}
        onOpenChange={setIsOpen}
      >
        <Modal.Container className="w-full max-w-lg rounded-2xl">
          <Modal.Dialog className="backdrop-blur-xl backdrop-saturate-150 bg-white/70 dark:bg-zinc-900/70 shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_8px_32px_rgb(0_0_0/0.12)] dark:shadow-[inset_0_1px_0_rgb(255_255_255/0.07),0_8px_32px_rgb(0_0_0/0.4)]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading className="text-2xl font-semibold">
                {searchedWord}
              </Modal.Heading>
            </Modal.Header>

            <div className="m-0 py-4" >
              <WordDetail word={searchedWord} onDataLoaded={setWordDetailResult} />
            </div>

            {wordDetailResult === true && !isChecking && !wordExists && (
              <Modal.Footer>
                <Button
                  variant="primary"
                  isPending={isSaving}
                  onPress={handleAddToVocab}
                >
                  {isSaving ? <Spinner color="current" size="sm" /> : null}
                  加入生词本
                </Button>
              </Modal.Footer>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}

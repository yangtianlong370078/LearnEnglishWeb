"use client";

import { useState } from "react";
import { Button } from "@heroui/react";

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <Button
      className="rounded-full"
      onPress={() => setCount((prev) => prev + 1)}
    >
      Count is {count}
    </Button>
  );
};

import type { SVGProps } from "react";
import type { ExamMode } from "./types";

import {
  CnEnIcon,
  EnCnIcon,
  MicrophoneIcon,
  SpeakerIcon,
} from "@/components/courselearn/mode-icons";

export default function ExamModeIcon({
  mode,
  ...props
}: { mode: ExamMode } & SVGProps<SVGSVGElement>) {
  if (mode === "cn-en") return <CnEnIcon {...props} />;
  if (mode === "dictation") return <SpeakerIcon {...props} />;
  if (mode === "speech") return <MicrophoneIcon {...props} />;

  return <EnCnIcon {...props} />;
}

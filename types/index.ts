import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export * from "./api";
export * from "./auth";
export * from "./course";
export * from "./task";
export * from "./word";

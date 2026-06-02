import {Label, Meter} from "@heroui/react";

export function MaterBasic() {
  return (
    <Meter aria-label="今日任务" className="w-64" value={60}>
      <Label>今日任务：5/10</Label>
      <Meter.Output />
      <Meter.Track>
        <Meter.Fill />
      </Meter.Track>
    </Meter>
  );
}
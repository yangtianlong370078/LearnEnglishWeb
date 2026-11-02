export default function ExamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full flex-col items-center justify-center gap-4 ">
      <div className="w-full min-w-0">{children}</div>
    </section>
  );
}

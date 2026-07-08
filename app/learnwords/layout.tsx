export default function LearnWordsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
     <section className="flex flex-col items-center justify-center gap-4 ">
        {children}
    </section>
  );
}

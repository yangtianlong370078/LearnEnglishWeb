export default function ListeningLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex w-full min-w-0 flex-col items-stretch">
      {children}
    </section>
  );
}

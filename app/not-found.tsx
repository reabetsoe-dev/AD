import Link from "next/link";
export default function NotFound() {
  return (
    <section className="container empty-page">
      <span className="eyebrow">404</span>
      <h1>Page not found</h1>
      <Link className="button button-red" href="/">
        Back to home
      </Link>
    </section>
  );
}

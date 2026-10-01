"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="container empty-page">
      <h1>This page could not load</h1>
      <p>Please check the local database is running, then try again.</p>
      <button className="button button-red" onClick={reset}>
        Try again
      </button>
    </section>
  );
}

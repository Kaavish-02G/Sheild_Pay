"use client";

import { FormEvent, useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <article className="shop-narrow">
      <h1 className="shop-page-title">Contact</h1>
      <p className="shop-muted" style={{ marginTop: 8 }}>
        hello@northline.shop · +1 (415) 555-0142
      </p>
      {sent ? (
        <p className="shop-lede">Thanks — we logged this demo message.</p>
      ) : (
        <form onSubmit={onSubmit} className="shop-form-stack" style={{ marginTop: 24 }}>
          <input required placeholder="Email" className="shop-field" />
          <textarea required placeholder="How can we help?" className="shop-field" style={{ minHeight: 112 }} />
          <button type="submit" className="shop-btn-primary">
            Send
          </button>
        </form>
      )}
    </article>
  );
}

const GiftSuccess = () => (
  <section className="min-h-screen flex items-center justify-center bg-cream px-4">
    <div className="text-center space-y-4">
      <h1 className="text-4xl font-black text-forest">Payment successful!</h1>
      <p className="text-forest/60 max-w-sm mx-auto">
        The gift code has been sent to your email. Forward it to your friend
        and they can redeem it when booking a lesson.
      </p>
      <a href="/" className="inline-block mt-4 px-8 py-4 bg-orange text-white font-bold rounded-2xl">
        Back to home
      </a>
    </div>
  </section>
);

export default GiftSuccess;
import { Helmet } from "react-helmet-async";
import Navbar from "./components/Navbar";
import Hook from "./components/Hook";
import Video from "./components/Video";
import About from "./components/About";
import Testimonial from "./components/Testimonial";
import CTA from "./components/CTA";
import SignupForm from "./components/SignupForm";
import Footer from "./components/Footer";
import GlobalAudioPlayer from "./components/GlobalAudioPlayer";
import LessonMap from "./components/LessonMap";
import ContactForm from "./components/ContactForm";

function App() {
  return (
    <div className="App">
      <Helmet>
        <title>Medya Handpan — Learn Handpan Online</title>
        <meta
          name="description"
          content="Learn handpan with Medya. Free 45-minute intro session. 500+ students worldwide. Book your session today."
        />
        <meta
          name="keywords"
          content="handpan lessons, learn handpan online, handpan teacher, handpan course"
        />
        <link rel="canonical" href="https://handpa-site-v3.vercel.app" />
        <meta
          property="og:title"
          content="Medya Handpan — Learn Handpan Online"
        />
        <meta
          property="og:description"
          content="Free 45-minute intro session. Book now."
        />
        <meta
          property="og:image"
          content="https://handpa-site-v3.vercel.app/images/medya.png"
        />
        <meta property="og:url" content="https://handpa-site-v3.vercel.app" />
      </Helmet>

      <Navbar />
      <GlobalAudioPlayer />
      <Hook />
      <Video />
      <CTA />
      <LessonMap />
      <About />
      <Testimonial />
      <SignupForm />
      <ContactForm />
      <Footer />
    </div>
  );
}

export default App;

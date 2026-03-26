import Hook from "./components/Hook";
import Testimonial from "./components/Testimonial";
import SignupForm from "./components/SignupForm";
import Footer from "./components/Footer";
import CTA from "./components/CTA";
import About from "./components/About";
import Video from "./components/Video";
import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="App">
      <Navbar/>
      <Hook />
      <Video />
      <About />
      <Testimonial />
      <CTA />
      <SignupForm />
      <Footer />
   
    </div>
  );
}

export default App;

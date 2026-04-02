import { useState } from "react";

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const timeOptions = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

const StudentIntakeForm = () => {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    lesson_mode: "online",
    in_person_location_type: "",
    student_address: "",
    experience_level: "complete_beginner",
    has_handpan: false,
    availability: {},
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const toggleDay = (day) => {
    setForm((prev) => {
      const newAvailability = { ...prev.availability };

      if (newAvailability[day]) {
        delete newAvailability[day];
      } else {
        newAvailability[day] = { start: "", end: "" };
      }

      return { ...prev, availability: newAvailability };
    });
  };

  const updateTime = (day, field, value) => {
    setForm((prev) => ({
      ...prev,
      availability: {
        ...prev.availability,
        [day]: {
          ...prev.availability[day],
          [field]: value,
        },
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSuccess("");
    setErrorMessage("");

    const availabilityArray = Object.entries(form.availability).map(
      ([day, times]) => ({
        day,
        start: times.start,
        end: times.end,
      })
    );

    try {
      const response = await fetch("/api/student-intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone,
          lesson_mode: form.lesson_mode,
          in_person_location_type: form.lesson_mode === "in_person"
            ? form.in_person_location_type
            : null,
          student_address:
            form.lesson_mode === "in_person" &&
            form.in_person_location_type === "student_place"
              ? form.student_address
              : null,
          experience_level: form.experience_level,
          has_handpan: form.has_handpan,
          availability_preferences: availabilityArray,
          message: form.message,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      setSuccess(data.message);

      setForm({
        full_name: "",
        email: "",
        phone: "",
        lesson_mode: "online",
        in_person_location_type: "",
        student_address: "",
        experience_level: "complete_beginner",
        has_handpan: false,
        availability: {},
        message: "",
      });
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="studentform" className="py-16 md:py-24 px-4 sm:px-8 bg-cream">
      <div className="max-w-4xl mx-auto rounded-3xl border border-sand bg-white shadow-sm overflow-hidden">
        <div className="p-6 md:p-10 space-y-8">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <span className="inline-block px-5 py-2.5 bg-forest text-cream text-xs font-bold uppercase tracking-widest rounded-full">
                Student Intake
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-forest leading-tight">
              Start your <span className="text-sage">handpan journey</span>
            </h1>

            <p className="text-forest/60 text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
              Fill out this form so I can better understand your goals,
              experience, and availability.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm({ ...form, full_name: e.target.value })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="Your full name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-forest mb-2">
                  Phone Number <span className="text-forest/40">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                  placeholder="Your phone number"
                />
              </div>
            </div>

            {/* Lesson Preference */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Lesson Preference
                </label>
                <select
                  value={form.lesson_mode}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lesson_mode: e.target.value,
                      in_person_location_type: "",
                      student_address: "",
                    })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                >
                  <option value="online">Online</option>
                  <option value="in_person">In-person</option>
                </select>
              </div>

              {form.lesson_mode === "in_person" && (
                <div className="space-y-5 rounded-3xl border border-sand bg-cream p-5 md:p-6">
                  <div>
                    <label className="block text-sm font-bold text-forest mb-2">
                      In-person Location
                    </label>
                    <select
                      value={form.in_person_location_type}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          in_person_location_type: e.target.value,
                          student_address: "",
                        })
                      }
                      className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                    >
                      <option value="">Select an option</option>
                      <option value="home_studio">In my home studio</option>
                      <option value="student_place">At your place</option>
                    </select>
                  </div>

                  {form.in_person_location_type === "student_place" && (
                    <>
                      <div className="rounded-2xl bg-orange/10 border border-orange/20 px-4 py-3 text-sm text-forest/70">
                        In-person lessons at your place include a{" "}
                        <span className="font-bold text-forest">$20 extra charge</span>{" "}
                        for commute.
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-forest mb-2">
                          Your Address
                        </label>
                        <input
                          type="text"
                          value={form.student_address}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              student_address: e.target.value,
                            })
                          }
                          className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                          placeholder="Enter your address"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Experience */}
            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Experience Level
                </label>
                <select
                  value={form.experience_level}
                  onChange={(e) =>
                    setForm({ ...form, experience_level: e.target.value })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                >
                  <option value="complete_beginner">Complete beginner</option>
                  <option value="some_musical_experience">
                    Some musical experience
                  </option>
                  <option value="already_playing_handpan">
                    Already playing handpan
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-forest mb-2">
                  Do you own a handpan?
                </label>
                <select
                  value={form.has_handpan ? "yes" : "no"}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      has_handpan: e.target.value === "yes",
                    })
                  }
                  className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Availability */}
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-forest mb-3">
                  Preferred Days
                </label>

                <div className="flex flex-wrap gap-3">
                  {daysOfWeek.map((day) => (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-4 py-2.5 rounded-2xl border text-sm font-medium transition-all ${
                        form.availability[day]
                          ? "bg-orange text-white border-orange"
                          : "bg-white text-forest border-forest/15 hover:bg-sand"
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {Object.keys(form.availability).length > 0 && (
                <div className="space-y-4">
                  {Object.keys(form.availability).map((day) => (
                    <div
                      key={day}
                      className="rounded-3xl border border-sand bg-cream p-4 md:p-5"
                    >
                      <p className="font-bold text-forest mb-3">{day}</p>

                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-forest/60 mb-2 uppercase tracking-wide">
                            Start time
                          </label>
                          <select
                            value={form.availability[day].start}
                            onChange={(e) =>
                              updateTime(day, "start", e.target.value)
                            }
                            className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                          >
                            <option value="">Select start time</option>
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-forest/60 mb-2 uppercase tracking-wide">
                            End time
                          </label>
                          <select
                            value={form.availability[day].end}
                            onChange={(e) =>
                              updateTime(day, "end", e.target.value)
                            }
                            className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors"
                          >
                            <option value="">Select end time</option>
                            {timeOptions.map((time) => (
                              <option key={time} value={time}>
                                {time}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-bold text-forest mb-2">
                Message / Goals
              </label>
              <textarea
                value={form.message}
                onChange={(e) =>
                  setForm({ ...form, message: e.target.value })
                }
                rows="5"
                className="w-full rounded-2xl border border-forest/15 bg-white px-4 py-3 text-forest outline-none focus:border-orange transition-colors resize-none"
                placeholder="Tell me about your goals, interests, or anything I should know..."
              />
            </div>

            {/* Feedback */}
            {success && (
              <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
                {success}
              </div>
            )}

            {errorMessage && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full px-8 py-4 bg-orange text-white text-base font-bold rounded-2xl shadow-md hover:bg-orange/90 hover:-translate-y-1 transition-all duration-300 disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default StudentIntakeForm;
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import UserMenu from "@/components/ui/user-menu";
import { supabase } from "../../../supabase/supabase";

export default function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    plan: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Save to database instead of sending email
      const { error } = await supabase.from("contact_messages").insert([
        {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          plan: formData.plan,
          message: formData.message,
          is_read: false,
        },
      ]);

      if (error) {
        console.error("Error saving message:", error);
        // Fallback to mailto if database save fails
        const subject = encodeURIComponent(
          `Contact Form Submission - ${formData.plan || "General Inquiry"}`,
        );
        const body = encodeURIComponent(
          `Name: ${formData.name}\n` +
            `Email: ${formData.email}\n` +
            `Phone: ${formData.phone}\n` +
            `Plan Option: ${formData.plan}\n` +
            `Message: ${formData.message}`,
        );
        const mailtoLink = `mailto:connect.newquiz@gmail.com?subject=${subject}&body=${body}`;
        window.location.href = mailtoLink;
      }

      setSubmitted(true);
      setFormData({
        name: "",
        email: "",
        phone: "",
        plan: "",
        message: "",
      });
    } catch (error) {
      console.error("Error submitting form:", error);
      // Fallback to mailto if there's any error
      const subject = encodeURIComponent(
        `Contact Form Submission - ${formData.plan || "General Inquiry"}`,
      );
      const body = encodeURIComponent(
        `Name: ${formData.name}\n` +
          `Email: ${formData.email}\n` +
          `Phone: ${formData.phone}\n` +
          `Plan Option: ${formData.plan}\n` +
          `Message: ${formData.message}`,
      );
      const mailtoLink = `mailto:connect.newquiz@gmail.com?subject=${subject}&body=${body}`;
      window.location.href = mailtoLink;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex flex-col">
        <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
          <Link to="/">
            <img
              src="https://i.postimg.cc/pXxdtDJz/quiz-online-logo.png"
              alt="Newquiz.online Logo"
              className="h-12 w-auto ml-0 sm:ml-16"
            />
          </Link>
          <UserMenu />
        </div>

        <div className="flex-1 flex items-center justify-center p-4 mt-20">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="p-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-navy mb-4">Thank You!</h2>
              <p className="text-navy/70 mb-6">
                Your message has been sent successfully. We'll get back to you
                soon!
              </p>
              <Link to="/">
                <Button className="bg-coral text-white hover:bg-coral/90">
                  Back to Home
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-blue-600 to-teal-500 flex flex-col">
      <div className="w-full bg-white flex justify-between items-center px-6 py-4 shadow-md fixed top-0 left-0 right-0 z-50">
        <Link to="/">
          <img
            src="https://i.postimg.cc/pXxdtDJz/quiz-online-logo.png"
            alt="Newquiz.online Logo"
            className="h-12 w-auto ml-16"
          />
        </Link>
        <UserMenu />
      </div>

      <main className="flex-1 flex items-center justify-center p-4 mt-20">
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Information */}
          <div className="space-y-8">
            <div className="text-white">
              <h1 className="text-4xl lg:text-5xl font-bold mb-4">
                Get in Touch
              </h1>
              <p className="text-xl text-white/90 mb-8">
                Have questions about our quiz platform? We're here to help!
              </p>
            </div>

            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Email</h3>
                    <p className="text-white/80">connect.newquiz@gmail.com</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-semibold mb-1">Address</h3>
                    <p className="text-white/80">Gujarat, India</p>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h3 className="text-white font-semibold mb-4">
                  Why Choose Us?
                </h3>
                <ul className="space-y-2 text-white/80">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Interactive quiz creation platform
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Real-time engagement features
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Comprehensive analytics
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    24/7 customer support
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <Card className="bg-white/95 backdrop-blur-md border-white/30">
            <CardHeader>
              <CardTitle className="text-2xl text-navy text-center">
                Send us a Message
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-navy font-medium">
                    Full Name *
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your full name"
                    className="bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-navy font-medium">
                    Email Address *
                  </Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your email address"
                    className="bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-navy font-medium">
                    Phone Number *
                  </Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your phone number"
                    className="bg-white/80"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="plan" className="text-navy font-medium">
                    Plan Option *
                  </Label>
                  <select
                    id="plan"
                    name="plan"
                    value={formData.plan}
                    onChange={handleInputChange}
                    required
                    className="flex h-9 w-full rounded-md border border-skyblue bg-white/80 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:border-coral"
                  >
                    <option value="">Select a plan</option>
                    <option value="Monthly Plan - ₹49/month">
                      Monthly Plan - ₹49/month
                    </option>
                    <option value="Yearly Plan - ₹499/year">
                      Yearly Plan - ₹499/year
                    </option>
                    <option value="Custom Website - ₹899/year">
                      Custom Website - ₹899/year
                    </option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="text-navy font-medium">
                    Message
                  </Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="Tell us more about your requirements..."
                    className="bg-white/80 min-h-[100px] border-skyblue focus-visible:ring-coral focus-visible:border-coral"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-coral text-white hover:bg-coral/90 text-lg py-3 h-auto"
                >
                  {isSubmitting ? "Sending..." : "Send Message"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

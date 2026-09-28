import React, { useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, MapPin, Phone, Send, CheckCircle, Loader2 } from "lucide-react";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);

    try {
      await api.integrations.Core.SendEmail({
        from_name: formData.name,
        to: "hello@herbyte.com",
        subject: `Herbyte Contact Form: ${formData.subject}`,
        body: `
Name: ${formData.name}
Email: ${formData.email}
Subject: ${formData.subject}

Message:
${formData.message}
        `
      });

      setSent(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (error) {
      console.error("Email send error:", error);
      alert("Failed to send message. Please try again.");
    }

    setSending(false);
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-[#2D5016] to-[#4A7C2E] text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Get in Touch</h1>
          <p className="text-xl text-white/90">
            Have questions, suggestions, or want to collaborate? We'd love to hear from you.
          </p>
        </div>
      </section>

      <div className="py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8 mb-12">
            {/* Contact Info Cards */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Email Us</h3>
                <p className="text-gray-600">info@cereustechnologies.com</p>
                <p className="text-sm text-gray-500 mt-2">We respond within 24 hours</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Call Us</h3>
                <p className="text-gray-600">+2347014623270</p>
                <p className="text-sm text-gray-500 mt-2">Mon-Fri, 9am-5pm EST</p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-14 h-14 bg-[#4A7C2E]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-7 h-7 text-[#2D5016]" />
                </div>
                <h3 className="font-semibold text-lg text-[#2D5016] mb-2">Visit Us</h3>
                <p className="text-gray-600">Lagos, Nigeria</p>
                <p className="text-sm text-gray-500 mt-2">West Africa</p>
              </CardContent>
            </Card>
          </div>

          {/* Contact Form */}
          <div className="grid md:grid-cols-2 gap-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-[#2D5016]">Send Us a Message</CardTitle>
              </CardHeader>
              <CardContent>
                {sent ?
                <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle className="w-10 h-10 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-[#2D5016] mb-3">Message Sent!</h3>
                    <p className="text-gray-600 mb-6">
                      Thank you for reaching out. We'll get back to you as soon as possible.
                    </p>
                    <Button onClick={() => setSent(false)} variant="outline">
                      Send Another Message
                    </Button>
                  </div> :

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <Label htmlFor="name">Your Name *</Label>
                      <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="John Doe"
                      className="mt-2" />

                    </div>

                    <div>
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                      id="email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="john@example.com"
                      className="mt-2" />

                    </div>

                    <div>
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                      id="subject"
                      required
                      value={formData.subject}
                      onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                      placeholder="How can we help?"
                      className="mt-2" />

                    </div>

                    <div>
                      <Label htmlFor="message">Message *</Label>
                      <Textarea
                      id="message"
                      required
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="Tell us more about your inquiry..."
                      rows={6}
                      className="mt-2" />

                    </div>

                    <Button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-[#4A7C2E] hover:bg-[#2D5016] text-lg py-6">

                      {sending ?
                    <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Sending...
                        </> :

                    <>
                          <Send className="w-5 h-5 mr-2" />
                          Send Message
                        </>
                    }
                    </Button>
                  </form>
                }
              </CardContent>
            </Card>

            {/* FAQ / Additional Info */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl text-[#2D5016]">Frequently Asked Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-[#2D5016] mb-2">How do I submit a remedy?</h4>
                    <p className="text-gray-600 text-sm">
                      Visit our Submit Remedy page and fill out the form. No account required! Our AI will review your submission for safety.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#2D5016] mb-2">Is the information medically reviewed?</h4>
                    <p className="text-gray-600 text-sm">
                      Yes! All information goes through AI validation and expert review by qualified herbalists and naturopathic doctors.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#2D5016] mb-2">Can I use herbs instead of medications?</h4>
                    <p className="text-gray-600 text-sm">
                      Always consult your healthcare provider before using herbs, especially if you're on medications. Never stop prescribed medications without medical supervision.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-[#2D5016] mb-2">How can I contribute as an expert?</h4>
                    <p className="text-gray-600 text-sm">
                      We're always looking to collaborate with qualified herbalists, naturopathic doctors, and researchers. Contact us to learn about partnership opportunities.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Alert className="bg-[#4A7C2E]/5 border-[#4A7C2E]/20">
                <AlertDescription className="text-gray-700">
                  <strong>Partnership Inquiries:</strong> Interested in collaborating with Herbyte? We welcome partnerships with healthcare providers, research institutions, and indigenous communities.
                </AlertDescription>
              </Alert>
            </div>
          </div>
        </div>
      </div>
    </div>);

}
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { getCatalog } from "@/lib/content";
import { addDays, businessDate } from "@/lib/dates";
import { enquiryError, EnquiryInputError, inputDate, inputPhone, inputText, readEnquiryBody } from "@/lib/enquiry-validation";
import { serviceBySlug, type Service } from "@/lib/services";
import { getStore } from "@/lib/store";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { canRecordEnquiries } from "@/lib/supabase/admin";
import type { LeadDetail } from "@/lib/store";
import { whatsappLink } from "@/lib/whatsapp";

/** Validate against the service specification; only accepted answers enter the lead. */
export async function POST(request: Request) {
  try {
    const raw = await readEnquiryBody(request);
    const service = serviceBySlug(inputText(raw.service, "Service") ?? "");
    if (!service) throw new EnquiryInputError("Unknown service.");

    const name = inputText(raw.customerName, "Name");
    const phone = inputPhone(raw.customerPhone, true);
    if (!raw.answers || typeof raw.answers !== "object" || Array.isArray(raw.answers)) {
      throw new EnquiryInputError("Expected the service answers.");
    }
    const answers = raw.answers as Record<string, unknown>;
    const details: LeadDetail[] = [];
    let pickupDate: string | null = null;
    let city: string | null = null;

    for (const field of service.fields) {
      const value = inputText(answers[field.name], field.label, field.type === "textarea" ? 600 : 120);
      if (field.required && !value) throw new EnquiryInputError(`${field.label} is needed.`);
      if (!value) continue;
      if (field.type === "date") {
        inputDate(value, field.label);
        pickupDate ??= value;
      }
      if (field.type === "select" && !field.options?.includes(value)) {
        throw new EnquiryInputError(`Choose one of the options for ${field.label.toLowerCase()}.`);
      }
      if (field.type === "number" && (!/^\d+(?:\.\d+)?$/.test(value) || !Number.isFinite(Number(value)) || Number(value) > 10_000)) {
        throw new EnquiryInputError(`${field.label} must be a number between 0 and 10,000.`);
      }
      if (field.name === "city") city = value;
      details.push({ label: field.label, value });
    }

    const returnDate = inputText(answers.returnDate, "Return date");
    if (returnDate) {
      inputDate(returnDate, "Return date");
      if (!pickupDate || returnDate < pickupDate) {
        throw new EnquiryInputError("Return date must be on or after the pickup date.");
      }
      details.push({ label: "Return date", value: returnDate });
    }

    const catalog = await getCatalog();
    if ((isSupabaseConfigured() || canRecordEnquiries()) && !catalog.live) {
      throw new EnquiryInputError("Enquiries are temporarily unavailable. Please try again shortly.", 503);
    }
    // Fallback references identify the WhatsApp ask without claiming a database record exists.
    let leadId = `ASK-${randomUUID().slice(0, 8).toUpperCase()}`;
    let recorded = false;
    try {
      const lead = await getStore().createLead({
        customerName: name,
        customerPhone: phone,
        customerPlace: city,
        serviceSlug: service.slug,
        serviceName: service.name,
        carSlug: null,
        carName: null,
        packageLabel: null,
        tripType: "",
        stops: [],
        pickupDate: pickupDate ?? "",
        pickupTime: "",
        haltHours: 0,
        km: 0,
        transferKm: 0,
        hours: 0,
        days: 0,
        lines: [],
        subtotal: 0,
        gst: 0,
        total: 0,
        advance: 0,
        status: "new",
        assignedTo: null,
        followUpOn: addDays(businessDate(), 1),
        notes: null,
        source: `service:${service.slug}`,
        details,
      });
      leadId = lead.leadId;
      recorded = true;
    } catch (error) {
      console.error("[enquiries/service] Could not record the lead:", error);
    }

    return NextResponse.json({
      whatsappHref: whatsappLink(catalog.settings.whatsappNumber, message(service, leadId, name, phone, details)),
      leadId,
      recorded,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return enquiryError(error);
  }
}

function message(service: Service, leadId: string, name: string | null, phone: string | null, details: LeadDetail[]): string {
  return [
    `*${service.name} enquiry*`,
    `Ref: ${leadId}`,
    name ? `Name: ${name}` : null,
    phone ? `Phone: ${phone}` : null,
    "",
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    "",
    "Sent from xoticcarrental.com",
  ].filter((line) => line !== null).join("\n");
}

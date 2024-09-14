// Import statements
import { clerkClient } from "@clerk/nextjs/server";
import { WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

// Define types
interface EmailAddress {
  email_address: string;
}

interface UserCreatedEventData {
  id: string;
  email_addresses: EmailAddress[];
  image_url: string;
  first_name: string;
  last_name: string;
  username: string;
}

interface UserUpdatedEventData {
  id: string;
  image_url: string;
  first_name: string;
  last_name: string;
  username: string;
}

interface UserDeletedEventData {
  id: string;
}

type UserEventData =
  | UserCreatedEventData
  | UserUpdatedEventData
  | UserDeletedEventData;

interface User {
  clerkId: string;
  email?: string; // Email may not be present in all cases (e.g., updates)
  username: string;
  firstName: string;
  lastName: string;
  photo?: string; // Photo may not be present in all cases (e.g., updates)
}

// Mock implementations of user actions
// Replace these with actual implementations
export async function createUser(user: User): Promise<User> {
  // Your logic to create a user in your system
  console.log("Creating user:", user);
  return user; // Replace with actual user creation logic
}

export async function updateUser(
  id: string,
  user: Partial<User>
): Promise<User> {
  // Your logic to update a user in your system
  console.log("Updating user:", id, user);
  return { ...user, clerkId: id } as User; // Replace with actual user update logic
}

export async function deleteUser(id: string): Promise<User> {
  // Your logic to delete a user in your system
  console.log("Deleting user:", id);
  return { clerkId: id, username: "deleted", firstName: "", lastName: "" }; // Replace with actual user deletion logic
}

// Webhook handling function
export async function POST(req: Request) {
  // Get the webhook secret from environment variables
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
    );
  }

  // Get the headers
  const headerPayload = headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If any required headers are missing, return an error
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the request body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  // Get the ID and type from the event
  const { id } = evt.data;
  const eventType = evt.type;

  // Handle the user created event
  if (eventType === "user.created") {
    const { id, email_addresses, image_url, first_name, last_name, username } =
      evt.data as UserCreatedEventData;

    const user: User = {
      clerkId: id,
      email: email_addresses[0].email_address,
      username: username!,
      firstName: first_name,
      lastName: last_name,
      photo: image_url,
    };

    const newUser = await createUser(user);

    // Set public metadata
    if (newUser) {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: {
          userId: newUser.clerkId,
        },
      });
    }

    return NextResponse.json({ message: "OK", user: newUser });
  }

  // Handle the user updated event
  if (eventType === "user.updated") {
    const { id, image_url, first_name, last_name, username } =
      evt.data as UserUpdatedEventData;

    const user: Partial<User> = {
      firstName: first_name,
      lastName: last_name,
      username: username!,
      photo: image_url,
    };

    const updatedUser = await updateUser(id, user);

    return NextResponse.json({ message: "OK", user: updatedUser });
  }

  // Handle the user deleted event
  if (eventType === "user.deleted") {
    const { id } = evt.data as UserDeletedEventData;

    const deletedUser = await deleteUser(id);

    return NextResponse.json({ message: "OK", user: deletedUser });
  }

  // Log unhandled events
  console.log(`Webhook with an ID of ${id} and type of ${eventType}`);
  console.log("Webhook body:", body);

  return new Response("", { status: 200 });
}

import { getToken } from './get-token';
import { db } from 'backend/db/db';
import { auth0Ids } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';

type Args = {
  userId: string;
};

type Output = {
  userId: string;
  auth0Id: string;
  status: number;
};

export async function blockAuth0User({ userId }: Args): Promise<Output> {
  // Get Auth0 management API token
  const token = await getToken();
  if (!token) {
    throw new Error('Failed to get Auth0 management API token');
  }

  // Get auth0Id from database
  const [auth0IdRecord] = await db
    .select()
    .from(auth0Ids)
    .where(eq(auth0Ids.userId, userId))
    .limit(1);

  if (!auth0IdRecord) {
    throw new Error(`No Auth0 ID found for user ${userId}`);
  }

  const auth0Id = auth0IdRecord.auth0Id;

  // Block user in Auth0 and set metadata
  const baseUrl = 'https://dev-t5wd7j8putzpb6ev.us.auth0.com/api/v2/users/';
  const url = baseUrl + auth0Id;

  const result = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      blocked: true,
      user_metadata: {
        account_deleted: true,
      },
    }),
  });

  if (result.status === 429) {
    throw new Error('Rate limit hit');
  }

  if (!result.ok) {
    const errorData = await result.json();
    throw new Error(errorData.message || 'Failed to block user in Auth0');
  }

  return { userId, auth0Id, status: result.status };
}

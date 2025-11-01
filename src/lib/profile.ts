export type Profile = {
  fullName?: string;
  email?: string;
  phone?: string;
};

const defaults: Required<Profile> = {
  fullName: "Admin User",
  email: "",
  phone: "62 821-9574-2400",
};

function currentUid(): string {
  try {
    const uid = sessionStorage.getItem("invgenz:uid");
    return uid && uid.trim() ? uid : "global";
  } catch {
    return "global";
  }
}

export function getProfile(): Required<Profile> {
  try {
    const uid = currentUid();
    const raw = localStorage.getItem(`invgenz:${uid}:profile`) || "{}";
    const p = JSON.parse(raw) as Profile;
    return { ...defaults, ...p };
  } catch {
    return defaults;
  }
}

export function saveProfile(patch: Profile) {
  try {
    const curr = getProfile();
    const next = { ...curr, ...patch } as Required<Profile>;
    const uid = currentUid();
    localStorage.setItem(`invgenz:${uid}:profile`, JSON.stringify(next));
    return next;
  } catch {
    // noop
    return getProfile();
  }
}
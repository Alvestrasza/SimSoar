import {redirect} from "next/navigation";
import {auth} from "@/auth";
import TaskPlanner from "@/app/components/TaskPlanner";
import {saveTaskAction} from "../actions";
import {setRequestLocale} from "next-intl/server";

export default async function NewTaskPage({params}: {params: Promise<{locale: string}>}) {
  const {locale} = await params;
  setRequestLocale(locale);
  const session = await auth().catch(() => null);
  if (!session?.user?.id) redirect(`/${locale}/login`);
  return <main className="wrap"><TaskPlanner action={saveTaskAction} locale={locale} /></main>;
}

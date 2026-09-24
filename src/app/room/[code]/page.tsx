import Room from "@/components/room/Room";

export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;
  return <Room key={code} code={code} />;
}

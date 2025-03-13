import { ComponentProps, FC } from "react";
import { Card, CardContent } from "./ui/card";
import { formatDate } from "@/lib/utils";

type Props = {
  session: {
    name: string;
    date: string;
    location: string;
    available?: number;
    event: {
      name: string;
    }
  };
} & ComponentProps<typeof Card>;

export const SessionCard: FC<Props> = ({ session, ...props }) => {
  return (
    <Card
      className={`rounded-lg border cursor-pointer transition-all ${props.className}`}
      {...props}
    >
      <CardContent>
        <div className="space-x-2">
          <span className="font-medium">{session.event.name}</span>
          <span>{session.name}</span>
        </div>
        <div className="text-sm text-foreground/60">{formatDate(session.date)}</div>
        <div className="text-sm text-foreground/60">{session.location}</div>
        {session.available !== undefined && (
          <div className={`text-sm mt-1 ${
            session.available <= 0 ? 'text-red-600' : 'text-green-600'
          }`}>
            残り{session.available}席
          </div>
        )}
      </CardContent>
    </Card>
  );
}

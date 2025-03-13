import { FC } from "react"
import { Card, CardContent } from "./ui/card"
import { Markdown } from "./markdown"
import Link from "next/link"

type Props = {
  event: {
    id: string
    name: string
    description: string
    sessions: {
      date: string|Date
      location: string
    }[]
  },
  link: string
}

export const EventCard: FC<Props> = ({event, link}) => {
  return (
    <Card className="p-6">
      <CardContent>
        <div className="flex flex-col h-full">
          <div>
            <h3 className="text-lg font-semibold mb-2">{event.name}</h3>
            {event.sessions.length > 0 && (
              <p className="text-sm mb-2">
                {new Date(event.sessions[0].date).toLocaleDateString()} ~ {new Date(event.sessions[event.sessions.length - 1].date).toLocaleDateString()}
              </p>
            )}
            <div className="text-sm mb-4 line-clamp-2 max-w-none">
              <Markdown>{event.description}</Markdown>
            </div>
          </div>
          <div className="flex items-center justify-between mt-auto pt-4 border-t">
            <span className="text-sm">
              セッション数: {event.sessions.length}
            </span>
            <Link
              href={link}
              className="text-blue-600 hover:text-blue-800"
            >
              詳細を見る
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
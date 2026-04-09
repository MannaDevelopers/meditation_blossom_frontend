//
//  sermonBuilder.m
//  meditation_blossom
//
//  Created by 최상준 on 4/9/26.
//

#import "sermonBuilder.h"

@implementation SermonBuilder

+ (NSMutableDictionary *)buildFromPayload:(NSDictionary *)data
                                 sourceId:(NSString *)sourceId
{
    NSMutableDictionary *sermonData = [@{
        @"id": sourceId ?: @"",
        @"source_id": sourceId ?: @"",
        @"title": data[@"title"] ?: @"",
        @"content": data[@"content"] ?: @"",
        @"category": data[@"category"] ?: @"",
        @"bible_references": data[@"bible_references"] ?: @"",
        @"meditation_questions": data[@"meditation_questions"] ?: @"",
        @"date": data[@"date"] ?: @"",
        @"year": data[@"year"] ?: @"",
        @"day_of_week": data[@"day_of_week"] ?: @"",
        @"video_url": @"",
        @"created_at": data[@"created_at"] ?: @"",
        @"updated_at": data[@"updated_at"] ?: @"",
        @"operation": data[@"operation"] ?: @"",
        @"topic": data[@"topic"] ?: @""
    } mutableCopy];

    if (data[@"video_url"]) {
        sermonData[@"video_url"] = data[@"video_url"];
    }

    return sermonData;
}

@end

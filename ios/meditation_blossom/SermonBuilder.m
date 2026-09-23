//
//  sermonBuilder.m
//  meditation_blossom
//
//  Created by 최상준 on 4/9/26.
//

#import "SermonBuilder.h"

@implementation SermonBuilder

+ (NSMutableDictionary *)buildFromPayload:(NSDictionary *)data
                                 sourceId:(NSString *)sourceId
{
    NSArray<NSDictionary *> *parsedBibleReferences =
        [SermonBuilder parsedBibleReferencesFromValue:data[@"bible_references"]];

    NSMutableDictionary *sermonData = [@{
        @"id": sourceId ?: @"",
        @"source_id": sourceId ?: @"",
        @"title": data[@"title"] ?: @"",
        @"content": data[@"content"] ?: @"",
        @"category": data[@"category"] ?: @"",
        @"series_title": data[@"series_title"] ?: @"",
        @"bible_references": parsedBibleReferences ?: @[],
        @"meditation_questions": data[@"meditation_questions"] ?: @"",
        @"date": data[@"date"] ?: @"",
        @"year": data[@"year"] ?: @"",
        @"day_of_week": data[@"day_of_week"] ?: @"",
        @"video_url": @"",
        @"created_at": data[@"created_at"] ?: @"",
        @"updated_at": data[@"updated_at"] ?: @"",
        @"operation": data[@"operation"] ?: @"",
        @"topic": data[@"topic"] ?: @"",
        // sermons-v2(worship_type별 예배, [#306]) 전용 필드. 레거시 payload엔 없어 빈 문자열로 채워지고,
        // 호출자가 이 두 값을 보고 sermons-v2 이벤트인지(week/worship_type 존재) 판단한다.
        @"week": data[@"week"] ?: @"",
        @"worship_type": data[@"worship_type"] ?: @""
    } mutableCopy];

    if (data[@"video_url"] && data[@"video_url"] != [NSNull null]) {
        sermonData[@"video_url"] = data[@"video_url"];
    }

    return sermonData;
}

+ (NSArray<NSDictionary *> *)parsedBibleReferencesFromValue:(id)rawValue
{
    if (!rawValue || rawValue == [NSNull null]) {
        return @[];
    }

    if ([rawValue isKindOfClass:[NSArray class]]) {
        NSMutableArray<NSDictionary *> *result = [NSMutableArray array];
        for (id item in (NSArray *)rawValue) {
            if ([item isKindOfClass:[NSDictionary class]]) {
                [result addObject:item];
            }
        }
        return [result copy];
    }

    if ([rawValue isKindOfClass:[NSString class]]) {
        NSString *jsonString = (NSString *)rawValue;
        NSData *jsonData = [jsonString dataUsingEncoding:NSUTF8StringEncoding];
        if (!jsonData) {
            return @[];
        }

        NSError *error = nil;
        id parsed = [NSJSONSerialization JSONObjectWithData:jsonData options:0 error:&error];
        if (error) {
            NSLog(@"❌ bible_references JSON parse error: %@", error);
            return @[];
        }

        if ([parsed isKindOfClass:[NSArray class]]) {
            NSMutableArray<NSDictionary *> *result = [NSMutableArray array];
            for (id item in (NSArray *)parsed) {
                if ([item isKindOfClass:[NSDictionary class]]) {
                    [result addObject:item];
                }
            }
            return [result copy];
        }
    }

    NSLog(@"❌ bible_references has unsupported type: %@", NSStringFromClass([rawValue class]));
    return @[];
}

@end

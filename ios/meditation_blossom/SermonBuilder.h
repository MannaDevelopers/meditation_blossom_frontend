//
//  sermonBuilder.h
//  meditation_blossom
//
//  Created by 최상준 on 4/9/26.
//

#import <Foundation/Foundation.h>

@interface SermonBuilder : NSObject

+ (NSMutableDictionary *)buildFromPayload:(NSDictionary *)data
                                 sourceId:(NSString *)sourceId;

+ (NSArray<NSDictionary *> *)parsedBibleReferencesFromValue:(id)rawValue;

@end
